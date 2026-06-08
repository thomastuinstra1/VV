import { Router } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import QRCode from 'qrcode';

import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import validate from '../middleware/validate.mjs';
import { registerValidator, loginValidator } from '../validators/authValidator.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';

import {
  toAuthStatusResponseDTO,
  toRegisterDTO,
  toRegisterResponseDTO,
  toLoginDTO,
  toLoginResponseDTO,
  toMeResponseDTO
} from '../dto/auth.dto.mjs';

import { toMessageResponseDTO } from '../dto/common.dto.mjs';

const router = Router();

async function postcodeNaarCoords(postcode) {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${postcode}&country=NL&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GereedschapspuntApp' }
  });

  const data = await res.json();
  if (!data.length) throw new Error('Postcode niet gevonden');

  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon)
  };
}

function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () =>
    crypto.randomInt(100000, 1000000).toString()
  );
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map(code => bcrypt.hash(code, 10)));
}

// ── Auth status ──
router.get('/auth-status', (req, res) => {
  res.json(toAuthStatusResponseDTO(!!req.session.userId));
});

// ── Registreren ──
router.post(
  '/register',
  registerValidator,
  validate,
  asyncHandler(async (req, res, next) => {
    const dto = toRegisterDTO(req.body);

    const bestaand = await prisma.account.findFirst({
      where: {
        OR: [{ Name: dto.name }, { E_mail: dto.email }]
      }
    });

    if (bestaand) {
      return next(new AppError('Naam of e-mail is al in gebruik', 400));
    }

    const hash = await bcrypt.hash(dto.password, 10);

    let coords = { lat: null, lon: null };

    try {
      coords = await postcodeNaarCoords(dto.postcode);
    } catch {
      console.warn('Coördinaten ophalen mislukt voor postcode:', dto.postcode);
    }

    const account = await prisma.account.create({
      data: {
        Name: dto.name,
        E_mail: dto.email,
        Password: hash,
        Postcode: dto.postcode,
        lat: coords.lat,
        lon: coords.lon
      }
    });

    res.status(201).json(toRegisterResponseDTO(account));
  })
);

// ── Inloggen ──
router.post(
  '/login',
  loginValidator,
  validate,
  asyncHandler(async (req, res, next) => {
    const dto = toLoginDTO(req.body);

    const account = await prisma.account.findFirst({
      where: {
        OR: [{ Name: dto.login }, { E_mail: dto.login }]
      }
    });

    if (!account) {
      return next(
        new AppError('Geen account gevonden met deze naam of dit e-mailadres', 401)
      );
    }

    const geldig = await bcrypt.compare(dto.password, account.Password);

    if (!geldig) {
      return next(new AppError('Ongeldig wachtwoord', 401));
    }

   if (account.two_factor_enabled) {
  console.log('COOKIES:', req.cookies);

  const trustedToken = req.cookies?.trusted_device;
  console.log('trustedToken:', trustedToken);

  if (trustedToken) {
    const devices = await prisma.trusted_device.findMany({
      where: {
        Account_id: account.Account_id,
        Expires_at: { gt: new Date() }
      }
    });

    console.log('devices found:', devices.length);

    for (const device of devices) {
      const match = await bcrypt.compare(trustedToken, device.Token_hash);
      console.log('device match:', match);

      if (match) {
        req.session.userId = account.Account_id;
        req.session.Name = account.Name;

        return req.session.save((err) => {
          if (err) {
            return next(new AppError('Sessie opslaan mislukt', 500));
          }

          return res.json(toLoginResponseDTO(account));
        });
      }
    }
  }

  return res.json({
    requires2FA: true,
    userId: account.Account_id
  });
}

    req.session.userId = account.Account_id;
    req.session.Name = account.Name;

    req.session.save((err) => {
      if (err) {
        return next(new AppError('Sessie opslaan mislukt, probeer opnieuw', 500));
      }

      res.json(toLoginResponseDTO(account));
    });
  })
);

// ── 2FA login verificatie ──
router.post(
  '/login/2fa',
  asyncHandler(async (req, res, next) => {
    const { userId, token, trustDevice } = req.body;

    if (!userId || !token) {
      return next(new AppError('Gebruiker of 2FA-code ontbreekt', 400));
    }

    const account = await prisma.account.findUnique({
      where: { Account_id: Number(userId) }
    });

    if (!account) {
      return next(new AppError('Account niet gevonden', 404));
    }

    if (!account.two_factor_secret) {
      return next(new AppError('2FA is niet ingesteld voor dit account', 400));
    }

    if (
      account.two_factor_block_until &&
      new Date() < account.two_factor_block_until
    ) {
      return next(
        new AppError('Te veel mislukte pogingen. Probeer later opnieuw.', 429)
      );
    }

    let verified = speakeasy.totp.verify({
      secret: account.two_factor_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified && account.two_factor_recovery_codes) {
      for (let i = 0; i < account.two_factor_recovery_codes.length; i++) {
        const match = await bcrypt.compare(
          token,
          account.two_factor_recovery_codes[i]
        );

        if (match) {
          verified = true;

          const updatedCodes = [...account.two_factor_recovery_codes];
          updatedCodes.splice(i, 1);

          await prisma.account.update({
            where: { Account_id: account.Account_id },
            data: {
              two_factor_recovery_codes: updatedCodes
            }
          });

          break;
        }
      }
    }

    if (!verified) {
      const attempts = (account.two_factor_attempts || 0) + 1;

      const updateData = {
        two_factor_attempts: attempts
      };

      if (attempts >= 5) {
        updateData.two_factor_attempts = 0;
        updateData.two_factor_block_until = new Date(Date.now() + 5 * 60 * 1000);
      }

      await prisma.account.update({
        where: { Account_id: account.Account_id },
        data: updateData
      });

      return next(new AppError('Ongeldige 2FA-code', 401));
    }

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: {
        two_factor_attempts: 0,
        two_factor_block_until: null
      }
    });

   if (trustDevice) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);

  await prisma.trusted_device.create({
    data: {
      Account_id: account.Account_id,
      Token_hash: tokenHash,
      Device_name: req.headers['user-agent'] || 'Onbekend apparaat',
      Expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  res.cookie('trusted_device', rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

req.session.userId = account.Account_id;
req.session.Name = account.Name;

    req.session.save((err) => {
      if (err) {
        return next(new AppError('Sessie opslaan mislukt, probeer opnieuw', 500));
      }

      return res.json(toLoginResponseDTO(account));
    });
  })
);

// ── 2FA setup ──
router.post(
  '/2fa/setup',
  isLoggedIn,
  asyncHandler(async (req, res, next) => {
    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId }
    });

    if (account.two_factor_enabled) {
      return next(new AppError('2FA is al ingeschakeld', 400));
    }

    const secret = speakeasy.generateSecret({
      name: `GereedschapsPunt (${account.E_mail})`
    });

    req.session.temp2FASecret = secret.base32;

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      qrCodeUrl,
      manualCode: secret.base32
    });
  })
);

// ── 2FA inschakelen ──
router.post(
  '/2fa/enable',
  isLoggedIn,
  asyncHandler(async (req, res, next) => {
    const { token } = req.body;
    const secret = req.session.temp2FASecret;

    if (!secret) {
      return next(new AppError('Start eerst de 2FA setup', 400));
    }

    if (!token) {
      return next(new AppError('2FA-code ontbreekt', 400));
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return next(new AppError('Ongeldige 2FA-code', 400));
    }

    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await hashBackupCodes(backupCodes);

    const updatedAccount = await prisma.account.update({
  where: { Account_id: req.session.userId },
  data: {
    two_factor_enabled: true,
    two_factor_secret: secret,
    two_factor_recovery_codes: hashedBackupCodes
  }
});

fetch(process.env.APPS_SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: '2fa_enabled',
    userEmail: updatedAccount.E_mail,
    userName: updatedAccount.Name
  })
}).catch(err => console.error('2FA enabled mail error:', err));

delete req.session.temp2FASecret;

res.json({
  message: '2FA ingeschakeld',
  backupCodes
});
  })
);

// ── Trusted devices ophalen ──
router.get(
  '/2fa/trusted-devices',
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const devices = await prisma.trusted_device.findMany({
      where: { Account_id: req.session.userId },
      select: {
        Trusted_device_id: true,
        Device_name: true,
        Created_at: true,
        Expires_at: true
      }
    });

    res.json(devices);
  })
);

// ── Trusted device verwijderen ──
router.delete(
  '/2fa/trusted-devices/:id',
  isLoggedIn,
  asyncHandler(async (req, res) => {
    await prisma.trusted_device.deleteMany({
      where: {
        Trusted_device_id: Number(req.params.id),
        Account_id: req.session.userId
      }
    });

    res.json({ message: 'Verwijderd' });
  })
);

// ── 2FA recovery request ──
router.post(
  '/2fa/recovery/request',
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const safeMessage =
      'Als dit e-mailadres bestaat, is er een herstel-link verzonden.';

    const account = await prisma.account.findUnique({
      where: { E_mail: email }
    });

    if (!account || !account.two_factor_enabled) {
      return res.json({ message: safeMessage });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: {
        two_factor_recovery_code: tokenHash,
        two_factor_recovery_expires: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    const recoveryLink = `${process.env.TWO_FA_RECOVERY_URL}?token=${token}`;

    console.log('APPS_SCRIPT_URL:', process.env.APPS_SCRIPT_URL);
    console.log('TWO_FA_RECOVERY_URL:', process.env.TWO_FA_RECOVERY_URL);
    console.log('Recovery link:', recoveryLink);

    try {
      const mailRes = await fetch(process.env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: '2fa_recovery',
          userEmail: account.E_mail,
          userName: account.Name,
          recoveryUrl: recoveryLink
        })
      });

      const mailText = await mailRes.text();
      console.log('2FA recovery mail response:', mailText);
    } catch (err) {
      console.error('2FA recovery mail error:', err);
    }

    res.json({ message: safeMessage });
  })
);

// ── 2FA recovery confirm ──
router.post(
  '/2fa/recovery/confirm',
  asyncHandler(async (req, res, next) => {
    const { token, password } = req.body;

    if (!token || !password) {
      return next(new AppError('Token of wachtwoord ontbreekt', 400));
    }

    const accounts = await prisma.account.findMany({
      where: {
        two_factor_recovery_code: { not: null },
        two_factor_recovery_expires: { gt: new Date() }
      }
    });

    let account = null;

    for (const acc of accounts) {
      const match = await bcrypt.compare(token, acc.two_factor_recovery_code);

      if (match) {
        account = acc;
        break;
      }
    }

    if (!account) {
      return next(new AppError('Ongeldige of verlopen herstel-link', 400));
    }

    const passwordOk = await bcrypt.compare(password, account.Password);

    if (!passwordOk) {
      return next(new AppError('Ongeldig wachtwoord', 401));
    }

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_recovery_codes: null,
        two_factor_recovery_code: null,
        two_factor_recovery_expires: null
      }
    });

    fetch(process.env.APPS_SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: '2fa_disabled',
    userEmail: account.E_mail,
    userName: account.Name
  })
}).catch(err => console.error('2FA recovery disabled mail error:', err));

    res.json({ message: '2FA hersteld' });
  })
);

// ── 2FA uitschakelen ──
router.post(
  '/2fa/disable',
  isLoggedIn,
  asyncHandler(async (req, res, next) => {
    const { password, token } = req.body;

    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId }
    });

    if (!account || !account.two_factor_enabled) {
      return next(new AppError('2FA is niet ingeschakeld', 400));
    }

    if (!password || !token) {
      return next(new AppError('Wachtwoord en 2FA-code zijn verplicht', 400));
    }

    const passwordOk = await bcrypt.compare(password, account.Password);

    if (!passwordOk) {
      return next(new AppError('Ongeldig wachtwoord', 401));
    }

    let verified = speakeasy.totp.verify({
      secret: account.two_factor_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified && account.two_factor_recovery_codes) {
      const codes = account.two_factor_recovery_codes;

      for (let i = 0; i < codes.length; i++) {
        const match = await bcrypt.compare(token, codes[i]);

        if (match) {
          verified = true;
          break;
        }
      }
    }

    if (!verified) {
      return next(new AppError('Ongeldige 2FA-code of backupcode', 401));
    }

    await prisma.account.update({
      where: { Account_id: req.session.userId },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_recovery_codes: null
      }
    });

    fetch(process.env.APPS_SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: '2fa_disabled',
    userEmail: account.E_mail,
    userName: account.Name
  })
}).catch(err => console.error('2FA disabled mail error:', err));

    res.json({ message: '2FA uitgeschakeld' });
  })
);

// ── Uitloggen ──
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(new AppError('Uitloggen mislukt, probeer opnieuw', 500));
    }

    res.clearCookie('connect.sid');
    res.json(toMessageResponseDTO('Uitgelogd'));
  });
});

// ── Huidig ingelogde gebruiker ──
router.get(
  '/me',
  isLoggedIn,
  asyncHandler(async (req, res, next) => {
    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId },
      select: {
        Account_id: true,
        Name: true,
        E_mail: true,
        Postcode: true,
        Afbeelding: true,
        lat: true,
        lon: true,
        two_factor_enabled: true
      }
    });

    if (!account) {
      return next(
        new AppError('Ingelogde gebruiker niet gevonden in de database', 404)
      );
    }

    res.json({
      ...toMeResponseDTO(account),
      two_factor_enabled: account.two_factor_enabled
    });
  })
);

export default router;
