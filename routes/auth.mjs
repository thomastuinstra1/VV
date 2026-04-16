import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { postcodeNaarCoords } from '../public/js/afstandfilter.js';
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

import {
  toMessageResponseDTO
} from '../dto/common.dto.mjs';

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