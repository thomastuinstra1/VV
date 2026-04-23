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

// ── Profielen zoeken ──
router.get(
  '/accounts/zoeken',
  asyncHandler(async (req, res, next) => {
    const zoekterm = req.query.q?.trim();

    if (!zoekterm) {
      return next(new AppError('Geen zoekterm opgegeven', 400));
    }

    const accounts = await prisma.account.findMany({
      where: {
        Name: {
          contains: zoekterm
        }
      },
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