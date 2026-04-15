import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { postcodeNaarCoords } from '../public/js/afstandfilter.js';
import validate from '../middleware/validate.mjs';
import { registerValidator, loginValidator } from '../validators/authValidator.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';

const router = Router();

// ── Auth status ──
router.get('/auth-status', (req, res) => {
  res.json({ ingelogd: !!req.session.userId });
});

// ── Registreren ──
router.post('/register', registerValidator, validate, asyncHandler(async (req, res, next) => {
  const { Name, E_mail, Password, Postcode } = req.body;

  const bestaand = await prisma.account.findFirst({
    where: { OR: [{ Name }, { E_mail }] }
  });
  if (bestaand) return next(new AppError('Naam of e-mail is al in gebruik', 400));

  const hash = await bcrypt.hash(Password, 10);

  let coords = { lat: null, lon: null };
  try {
    coords = await postcodeNaarCoords(Postcode);
  } catch {
    console.warn('Coördinaten ophalen mislukt voor postcode:', Postcode);
  }

  const account = await prisma.account.create({
    data: { Name, E_mail, Password: hash, Postcode, lat: coords.lat, lon: coords.lon }
  });

  res.status(201).json({ message: 'Account aangemaakt!', id: account.Account_id });
}));

// ── Inloggen ──
router.post('/login', loginValidator, validate, asyncHandler(async (req, res, next) => {
  const { login, Password } = req.body;

  const account = await prisma.account.findFirst({
    where: { OR: [{ Name: login }, { E_mail: login }] }
  });
  if (!account) return next(new AppError('Geen account gevonden met deze naam of dit e-mailadres', 401));

  const geldig = await bcrypt.compare(Password, account.Password);
  if (!geldig) return next(new AppError('Ongeldig wachtwoord', 401));

  req.session.userId = account.Account_id;
  req.session.Name   = account.Name;

  req.session.save(err => {
    if (err) return next(new AppError('Sessie opslaan mislukt, probeer opnieuw', 500));
    res.json({ message: 'Ingelogd!', Name: account.Name });
  });
}));

// ── Uitloggen ──
router.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(new AppError('Uitloggen mislukt, probeer opnieuw', 500));
    res.clearCookie('connect.sid');
    res.json({ message: 'Uitgelogd' });
  });
});

// ── Huidig ingelogde gebruiker ──
router.get('/me', isLoggedIn, asyncHandler(async (req, res, next) => {
  const account = await prisma.account.findUnique({
    where: { Account_id: req.session.userId },
    select: { Account_id: true, Name: true, E_mail: true, Postcode: true, BSN: true, Afbeelding: true, lat: true, lon: true }
  });
  if (!account) return next(new AppError('Ingelogde gebruiker niet gevonden in de database', 404));
  res.json(account);
}));

export default router;
