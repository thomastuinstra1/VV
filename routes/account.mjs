import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { upload } from '../middleware/upload.mjs';
import validate from '../middleware/validate.mjs';
import { updateAccountValidator } from '../validators/accountValidator.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';

import {
  toUpdateAccountDTO,
  toUpdateAccountResponseDTO,
  toReportDTO,
  toPubliekProfielResponseDTO
} from '../dto/account.dto.mjs';

import {
  toMessageResponseDTO,
  toUploadAfbeeldingResponseDTO
} from '../dto/common.dto.mjs';

const router = Router();

// ── Alle accounts ophalen ──
router.get('/Account', isLoggedIn, asyncHandler(async (req, res) => {
  const accounts = await prisma.account.findMany();
  res.json(accounts); // eventueel later nog DTO van maken
}));

// ── Account bijwerken ──
router.put(
  '/account',
  isLoggedIn,
  updateAccountValidator,
  validate,
  asyncHandler(async (req, res, next) => {

    const dto = toUpdateAccountDTO(req.body);
    const data = {};

    if (dto.email) {
      const bestaandEmail = await prisma.account.findFirst({
        where: {
          E_mail: dto.email,
          NOT: { Account_id: req.session.userId }
        }
      });
      if (bestaandEmail) {
        return next(new AppError('Dit e-mailadres is al in gebruik', 400));
      }
      data.E_mail = dto.email;
    }

    if (dto.name) data.Name = dto.name;
    if (dto.postcode) data.Postcode = dto.postcode;
    if (dto.password) data.Password = await bcrypt.hash(dto.password, 10);

    const account = await prisma.account.update({
      where: { Account_id: req.session.userId },
      data
    });

    if (dto.name) req.session.Name = account.Name;

    res.json(toUpdateAccountResponseDTO(account));
  })
);

// ── Profielfoto uploaden ──
router.post(
  '/account/afbeelding',
  isLoggedIn,
  upload.single('afbeelding'),
  asyncHandler(async (req, res, next) => {

    if (!req.file) {
      return next(new AppError('Geen geldig afbeeldingsbestand ontvangen', 400));
    }

    const afbeeldingUrl = '/uploads/' + req.file.filename;

    await prisma.account.update({
      where: { Account_id: req.session.userId },
      data: { Afbeelding: afbeeldingUrl }
    });

    res.json(toUploadAfbeeldingResponseDTO(afbeeldingUrl));
  })
);

// ── Account rapporteren ──
router.post(
  '/account/:id/report',
  isLoggedIn,
  asyncHandler(async (req, res, next) => {

    const gemeldId = parseInt(req.params.id);
    const melderId = req.session.userId;
    const dto = toReportDTO(req.body);

    if (gemeldId === melderId) {
      return next(new AppError('Je kunt jezelf niet rapporteren', 400));
    }

    const bestaand = await prisma.report.findFirst({
      where: {
        Melder_id: melderId,
        Gemelde_id: gemeldId
      }
    });

    if (bestaand) {
      return next(new AppError('Je hebt dit account al gerapporteerd', 400));
    }

    await prisma.report.create({
      data: {
        Melder_id: melderId,
        Gemelde_id: gemeldId,
        Reden: dto.reden
      }
    });

    res.json(toMessageResponseDTO('Rapport ingediend!'));
  })
);

// ── Publiek profiel ophalen ──
router.get(
  '/account/:id/profiel',
  asyncHandler(async (req, res, next) => {

    const accountId = parseInt(req.params.id);

    const account = await prisma.account.findUnique({
      where: { Account_id: accountId },
      select: {
        Account_id: true,
        Name: true,
        E_mail: true,
        Postcode: true,
        Afbeelding: true
      }
    });

    if (!account) {
      return next(new AppError('Account niet gevonden', 404));
    }

    const aantalRapporten = await prisma.report.count({
      where: { Gemelde_id: accountId }
    });

    res.json(
      toPubliekProfielResponseDTO(account, aantalRapporten)
    );
  })
);

<<<<<<< HEAD
// ── 2FA setup QR-code maken ──
router.post(
  '/2fa/setup',
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const secret = speakeasy.generateSecret({
      name: `Gereedschapspunt (${req.session.Name})`
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    req.session.temp2FASecret = secret.base32;

    res.json({ qrCodeUrl });
  })
);
router.post(
  '/2fa/setup',
  isLoggedIn,
  asyncHandler(async (req, res) => {
    const secret = speakeasy.generateSecret({
      name: `Gereedschapspunt (${req.session.Name})`
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    req.session.temp2FASecret = secret.base32;

    res.json({ qrCodeUrl });
  })
);
// ── 2FA inschakelen + recovery code maken ──
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

    const recoveryCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const hashedRecoveryCode = await bcrypt.hash(recoveryCode, 10);

    await prisma.account.update({
      where: { Account_id: req.session.userId },
      data: {
        two_factor_enabled: true,
        two_factor_secret: secret,
        two_factor_recovery_code: hashedRecoveryCode
      }
    });

    delete req.session.temp2FASecret;

    res.json({
      message: '2FA ingeschakeld',
      recoveryCode
    });
  })
);

// ── 2FA uitschakelen, alleen met geldige 2FA code ──
router.post(
  '/2fa/disable',
  isLoggedIn,
  asyncHandler(async (req, res, next) => {
    const { token } = req.body;

    if (!token) {
      return next(new AppError('2FA-code ontbreekt', 400));
    }

    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId }
    });

    if (!account || !account.two_factor_secret) {
      return next(new AppError('2FA staat niet aan', 400));
    }

    const verified = speakeasy.totp.verify({
      secret: account.two_factor_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return next(new AppError('Ongeldige 2FA-code', 401));
    }

    await prisma.account.update({
      where: { Account_id: req.session.userId },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_recovery_code: null
      }
    });

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
=======
// ── Profielen zoeken ──
>>>>>>> parent of b28d71e (2)
router.get(
  '/accounts/zoeken',
  asyncHandler(async (req, res, next) => {
    const zoekterm = req.query.q?.trim();

    if (!zoekterm) {
      return next(new AppError('Geen zoekterm opgegeven', 400));
    }

    const where = {
      Name: {
        contains: zoekterm
      }
    };

    // Sluit eigen account uit als de gebruiker is ingelogd
    if (req.session?.userId) {
      where.Account_id = { not: req.session.userId };
    }

    const accounts = await prisma.account.findMany({
      where,
      select: {
        Account_id: true,
        Name: true,
        Postcode: true,
        Afbeelding: true
      },
      take: 20
    });

    res.json(accounts);
  })
);

export default router;