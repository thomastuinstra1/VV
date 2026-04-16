import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../prismaClient.mjs';
import validate from '../middleware/validate.mjs';
import { wachtwoordVergetenValidator, wachtwoordResetValidator } from '../validators/passwordValidator.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';

import {
  toForgotPasswordDTO,
  toResetPasswordDTO,
} from '../dto/password.dto.mjs';

import {
  toMessageResponseDTO
} from '../dto/common.dto.mjs';

const router = Router();


// ── WACHTWOORD VERGETEN ──
router.post(
  '/forgot-password',
  wachtwoordVergetenValidator,
  validate,
  asyncHandler(async (req, res) => {

    const dto = toForgotPasswordDTO(req.body);

    const account = await prisma.account.findFirst({
      where: { E_mail: dto.email }
    });

    // bewust geen onderscheid maken (security)
    if (!account) {
      return res.json(
        toMessageResponseDTO(
          'Als dit e-mailadres bekend is, ontvang je een link.'
        )
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry
      }
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

    res.json(
      toMessageResponseDTO(
        'Als dit e-mailadres bekend is, ontvang je een link.'
      )
    );
  })
);


// ── RESET PASSWORD ──
router.post(
  '/reset-password',
  wachtwoordResetValidator,
  validate,
  asyncHandler(async (req, res, next) => {

    const dto = toResetPasswordDTO(req.body);

    const account = await prisma.account.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!account) {
      return next(
        new AppError('Deze resetlink is ongeldig of verlopen', 400)
      );
    }

    const hash = await bcrypt.hash(dto.password, 10);

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: {
        Password: hash,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json(
      toMessageResponseDTO('Wachtwoord succesvol gewijzigd!')
    );
  })
);

export default router;