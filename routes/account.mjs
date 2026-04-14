import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { upload } from '../middleware/upload.mjs';
import validate from '../middleware/validate.mjs';
import { updateAccountValidator } from '../validators/accountValidator.mjs';

const router = Router();

// ── Alle accounts ophalen ──
router.get('/Account', isLoggedIn, async (req, res) => {
  try {
    const accounts = await prisma.account.findMany();
    res.json(accounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// ── Account bijwerken ──
router.put('/account', isLoggedIn, updateAccountValidator, validate, async (req, res) => {
  const { Name, E_mail, Postcode, Password, BSN } = req.body;
  try {
    const data = {};

    if (E_mail) {
      const bestaandEmail = await prisma.account.findFirst({
        where: { E_mail, NOT: { Account_id: req.session.userId } }
      });
      if (bestaandEmail) return res.status(400).json({ message: 'Dit e-mailadres is al in gebruik' });
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// ── Profielfoto uploaden ──
router.post('/account/afbeelding', isLoggedIn, upload.single('afbeelding'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen geldig afbeeldingsbestand' });
  try {
    const afbeeldingUrl = '/uploads/' + req.file.filename;
    await prisma.account.update({
      where: { Account_id: req.session.userId },
      data: { Afbeelding: afbeeldingUrl }
    });
    res.json({ message: 'Profielfoto opgeslagen!', url: afbeeldingUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

export default router;