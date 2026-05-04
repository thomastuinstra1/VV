import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import validate from '../middleware/validate.mjs';
import { registerValidator, loginValidator } from '../validators/authValidator.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';
import speakeasy from 'speakeasy';

import {
  toAuthStatusResponseDTO,
  toRegisterDTO,
  toRegisterResponseDTO,
  toLoginDTO,
  toLoginResponseDTO,
  toMeResponseDTO
} from '../dto/auth.dto.mjs';

import {
  toMessageResponseDTO
} from '../dto/common.dto.mjs';

// ── Lokale helper (geen frontend-koppeling meer) ──
async function postcodeNaarCoords(postcode) {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${postcode}&country=NL&format=json&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": "GereedschapspuntApp" } });
  const data = await res.json();
  if (!data.length) throw new Error("Postcode niet gevonden");
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

const router = Router();

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
        OR: [
          { Name: dto.name },
          { E_mail: dto.email }
        ]
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
        lat: coords.lat,  // ✅ fix
        lon: coords.lon   // ✅ fix
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
        OR: [
          { Name: dto.login },
          { E_mail: dto.login }
        ]
      }
    });

    if (!account) {
      return next(new AppError('Geen account gevonden met deze naam of dit e-mailadres', 401));
    }

    const geldig = await bcrypt.compare(dto.password, account.Password);

    if (!geldig) {
      return next(new AppError('Ongeldig wachtwoord', 401));
    }

    // ✅ If 2FA is enabled, do NOT log in yet
    if (account.two_factor_enabled === 1 || account.two_factor_enabled === true) {
      return res.json({
        requires2FA: true,
        userId: account.Account_id
      });
    }

    // ✅ Normal login when 2FA is off
    req.session.userId = account.Account_id;
    req.session.Name = account.Name;

    req.session.save(err => {
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
    const { userId, token } = req.body;

    if (!userId || !token) {
      return next(new AppError('Gebruiker of 2FA-code ontbreekt', 400));
    }

    const account = await prisma.account.findUnique({
      where: {
        Account_id: Number(userId)
      }
    });

    if (!account) {
      return next(new AppError('Account niet gevonden', 404));
    }

    if (!account.two_factor_secret) {
      return next(new AppError('2FA is niet ingesteld voor dit account', 400));
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

    req.session.userId = account.Account_id;
    req.session.Name = account.Name;

    req.session.save(err => {
      if (err) {
        return next(new AppError('Sessie opslaan mislukt, probeer opnieuw', 500));
      }

      res.json(toLoginResponseDTO(account));
    });
  })
);

// ── Uitloggen ──
router.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
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
        lon: true
      }
    });

    if (!account) {
      return next(new AppError('Ingelogde gebruiker niet gevonden in de database', 404));
    }

    res.json(toMeResponseDTO(account));
  })
);

export default router;