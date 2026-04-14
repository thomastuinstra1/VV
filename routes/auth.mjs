import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { postcodeNaarCoords } from '../public/js/afstandfilter.js';
import validate from '../middleware/validate.mjs';
import { registerValidator, loginValidator } from '../validators/authValidator.mjs';

const router = Router();

// ── Auth status ──
router.get('/auth-status', (req, res) => {
  res.json({ ingelogd: !!req.session.userId });
});

// ── Registreren ──
router.post('/register', registerValidator, validate, async (req, res) => {
  const { Name, E_mail, Password, Postcode } = req.body;
  try {
    const bestaand = await prisma.account.findFirst({
      where: { OR: [{ Name }, { E_mail }] }
    });
    if (bestaand) return res.status(400).json({ message: 'Naam of e-mail is al in gebruik' });

    const hash = await bcrypt.hash(Password, 10);

    let coords = { lat: null, lon: null };
    try {
      coords = await postcodeNaarCoords(Postcode);
    } catch (coordErr) {
      console.warn('Coördinaten ophalen mislukt:', coordErr);
    }

    const account = await prisma.account.create({
      data: { Name, E_mail, Password: hash, Postcode, lat: coords.lat, lon: coords.lon }
    });

    res.status(201).json({ message: 'Account aangemaakt!', id: account.Account_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// ── Inloggen ──
router.post('/login', loginValidator, validate, async (req, res) => {
  const { login, Password } = req.body;
  try {
    const account = await prisma.account.findFirst({
      where: { OR: [{ Name: login }, { E_mail: login }] }
    });
    if (!account) return res.status(401).json({ message: 'Gebruiker niet gevonden' });

    const geldig = await bcrypt.compare(Password, account.Password);
    if (!geldig) return res.status(401).json({ message: 'Ongeldig wachtwoord' });

    req.session.userId = account.Account_id;
    req.session.Name = account.Name;

    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Sessie opslaan mislukt' });
      res.json({ message: 'Ingelogd!', Name: account.Name });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// ── Uitloggen ──
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Fout bij uitloggen' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Uitgelogd' });
  });
});

// ── Huidig ingelogde gebruiker ──
router.get('/me', isLoggedIn, async (req, res) => {
  try {
    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId },
      select: { Account_id: true, Name: true, E_mail: true, Postcode: true, BSN: true, Afbeelding: true, lat: true, lon: true }
    });
    if (!account) return res.status(404).json({ message: 'User not found' });
    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

export default router;