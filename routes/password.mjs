import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../prismaClient.mjs';
import validate from '../middleware/validate.mjs';
import { wachtwoordVergetenValidator, wachtwoordResetValidator } from '../validators/passwordValidator.mjs';

const router = Router();

// ── Wachtwoord vergeten ──
router.post('/forgot-password', wachtwoordVergetenValidator, validate, async (req, res) => {
  const { email } = req.body;
  try {
    const account = await prisma.account.findFirst({ where: { E_mail: email } });

    if (!account) return res.json({ message: 'Als dit e-mailadres bekend is, ontvang je een link.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: { resetToken: token, resetTokenExpiry: expiry }
    });

    const resetUrl = `${process.env.RESET_URL}?token=${token}`;

    await fetch(process.env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'password_reset',
        userEmail: account.E_mail,
        userName: account.Name,
        resetUrl
      })
    });

    res.json({ message: 'Als dit e-mailadres bekend is, ontvang je een link.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// ── Wachtwoord resetten ──
router.post('/reset-password', wachtwoordResetValidator, validate, async (req, res) => {
  const { token, password } = req.body;
  try {
    const account = await prisma.account.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } }
    });

    if (!account) return res.status(400).json({ error: 'Ongeldige of verlopen link.' });

    const hash = await bcrypt.hash(password, 10);

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: { Password: hash, resetToken: null, resetTokenExpiry: null }
    });

    res.json({ message: 'Wachtwoord succesvol gewijzigd!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

export default router;