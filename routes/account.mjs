import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { upload } from '../middleware/upload.mjs';
import validate from '../middleware/validate.mjs';
import { updateAccountValidator } from '../validators/accountValidator.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';

const router = Router();

// ── Alle accounts ophalen ──
router.get('/Account', isLoggedIn, asyncHandler(async (req, res) => {
  const accounts = await prisma.account.findMany();
  res.json(accounts);
}));

// ── Account bijwerken ──
router.put('/account', isLoggedIn, updateAccountValidator, validate, asyncHandler(async (req, res, next) => {
  const { Name, E_mail, Postcode, Password, BSN } = req.body;
  const data = {};

  if (E_mail) {
    const bestaandEmail = await prisma.account.findFirst({
      where: { E_mail, NOT: { Account_id: req.session.userId } }
    });
    if (bestaandEmail) return next(new AppError('Dit e-mailadres is al in gebruik', 400));
    data.E_mail = E_mail;
  }

  if (Name) data.Name = Name;
  if (Postcode) data.Postcode = Postcode;
  if (Password) data.Password = await bcrypt.hash(Password, 10);
  if (BSN) data.BSN = BSN;

  const account = await prisma.account.update({
    where: { Account_id: req.session.userId },
    data
  });

  if (Name) req.session.Name = account.Name;
  res.json({ message: 'Gegevens bijgewerkt!', Name: account.Name });
}));

// ── Profielfoto uploaden ──
router.post('/account/afbeelding', isLoggedIn, upload.single('afbeelding'), asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('Geen geldig afbeeldingsbestand ontvangen', 400));

  const afbeeldingUrl = '/uploads/' + req.file.filename;
  await prisma.account.update({
    where: { Account_id: req.session.userId },
    data: { Afbeelding: afbeeldingUrl }
  });
  res.json({ message: 'Profielfoto opgeslagen!', url: afbeeldingUrl });
}));

// ── Account rapporteren ──
router.post('/account/:id/report', isLoggedIn, asyncHandler(async (req, res, next) => {
  const gemeldId = parseInt(req.params.id);
  const melderId = req.session.userId;
  const { Reden } = req.body;

  if (gemeldId === melderId) return next(new AppError('Je kunt jezelf niet rapporteren', 400));

  const bestaand = await prisma.report.findFirst({
    where: { Melder_id: melderId, Gemelde_id: gemeldId }
  });
  if (bestaand) return next(new AppError('Je hebt dit account al gerapporteerd', 400));

  await prisma.report.create({
    data: { Melder_id: melderId, Gemelde_id: gemeldId, Reden }
  });

  res.json({ message: 'Rapport ingediend!' });
}));

// ── Publiek profiel ophalen ──
router.get('/account/:id/profiel', asyncHandler(async (req, res, next) => {
  const account = await prisma.account.findUnique({
    where: { Account_id: parseInt(req.params.id) },
    select: { Account_id: true, Name: true, E_mail: true, Postcode: true, Afbeelding: true }
  });
  if (!account) return next(new AppError('Account niet gevonden', 404));

  const aantalRapporten = await prisma.report.count({
    where: { Gemelde_id: parseInt(req.params.id) }
  });

  res.json({ ...account, aantalRapporten });
}));

export default router;
