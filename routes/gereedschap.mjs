import { Router } from 'express';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { sendEmail } from '../utils/email.mjs';
import { upload } from '../middleware/upload.mjs';
import validate from '../middleware/validate.mjs';
import { gereedschapValidator } from '../validators/gereedschapValidator.mjs';
import { idParamValidator } from '../validators/idParamValidator.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';

import {
  toGereedschapCreateDTO,
  toGereedschapCreateResponseDTO,
  toGereedschapResponseDTO,
  toGereedschapCategorieDTO,
} from '../dto/gereedschap.dto.mjs';

import {
  toUploadAfbeeldingResponseDTO
} from '../dto/common.dto.mjs';

const router = Router();


// ── CREATE GEREEDSCHAP ──
router.post(
  '/gereedschap',
  isLoggedIn,
  gereedschapValidator,
  validate,
  asyncHandler(async (req, res) => {

    const dto = toGereedschapCreateDTO(req.body);

    const tool = await prisma.gereedschap.create({
      data: {
        Naam: dto.name,
        Beschrijving: dto.description,
        Begindatum: dto.startDate ? new Date(dto.startDate) : null,
        Einddatum: dto.endDate ? new Date(dto.endDate) : null,
        BorgBedrag:
          dto.deposit && dto.deposit !== ''
            ? parseFloat(dto.deposit)
            : null,
        Afbeelding: dto.image,
        Account_id: req.session.userId
      }
    });

    if (dto.categories.length > 0) {
      await prisma.gereedschap_Categorie.createMany({
        data: dto.categories.map(cat => ({
          Gereedschap_id: tool.Gereedschap_id,
          Categorie_id: cat
        }))
      });
    }

    res.json(toGereedschapCreateResponseDTO(tool));
  })
);


// ── CATEGORIEEN ──
router.get(
  '/categorieen',
  asyncHandler(async (req, res) => {
    const categorieen = await prisma.categorie.findMany();
    res.json(toCategorieResponseDTO(categorieen));
  })
);


// ── GET GEREEDSCHAP ──
router.get(
  '/gereedschap',
  asyncHandler(async (req, res) => {

    const { search, id, categorieen } = req.query;
    let where = {};

    if (search) {
      where.Naam = { contains: search };
    } else if (id) {
      where.Gereedschap_id = parseInt(id);
    }

    if (categorieen) {
      const catIds = categorieen
        .split(',')
        .map(Number)
        .filter(Boolean);

      if (catIds.length > 0) {
        where.Gereedschap_Categorie = {
          some: { Categorie_id: { in: catIds } }
        };
      }
    }

    const tools = await prisma.gereedschap.findMany({
      where,
      include: {
        Account: {
          select: {
            Account_id: true,
            Name: true,
            Afbeelding: true,
            Report_Report_Gemelde_idToAccount: {
              select: { Report_id: true }
            }
          }
        }
      },
      orderBy: { Gereedschap_id: 'desc' }
    });

    res.json(toGereedschapResponseDTO(tools));
  })
);


// ── MIJN GEREEDSCHAP ──
router.get(
  '/mijn-gereedschap',
  isLoggedIn,
  asyncHandler(async (req, res) => {

    const tools = await prisma.gereedschap.findMany({
      where: { Account_id: req.session.userId },
      orderBy: { Gereedschap_id: 'desc' }
    });

    res.json(toGereedschapResponseDTO(tools));
  })
);


// ── CATEGORIEEN VAN GEREEDSCHAP ──
router.get(
  '/gereedschap/:id/categorieen',
  idParamValidator,
  validate,
  asyncHandler(async (req, res) => {

    const koppelingen = await prisma.gereedschap_Categorie.findMany({
      where: { Gereedschap_id: parseInt(req.params.id) }
    });

    res.json(toGereedschapCategorieDTO(koppelingen));
  })
);


// ── UPDATE ──
router.put(
  '/gereedschap/:id',
  isLoggedIn,
  idParamValidator,
  gereedschapValidator,
  validate,
  asyncHandler(async (req, res, next) => {

    const id = parseInt(req.params.id);
    const dto = toGereedschapCreateDTO(req.body);

    const tool = await prisma.gereedschap.findUnique({
      where: { Gereedschap_id: id }
    });

    if (!tool || tool.Account_id !== req.session.userId) {
      return next(new AppError('Gereedschap niet gevonden of je hebt geen toegang', 403));
    }

    await prisma.gereedschap.update({
      where: { Gereedschap_id: id },
      data: {
        Naam: dto.name,
        Beschrijving: dto.description,
        BorgBedrag: dto.deposit ? parseFloat(dto.deposit) : null,
        Begindatum: dto.startDate ? new Date(dto.startDate) : null,
        Einddatum: dto.endDate ? new Date(dto.endDate) : null
      }
    });

    if (dto.categories !== undefined) {
      await prisma.gereedschap_Categorie.deleteMany({
        where: { Gereedschap_id: id }
      });

      if (dto.categories.length > 0) {
        await prisma.gereedschap_Categorie.createMany({
          data: dto.categories.map(catId => ({
            Gereedschap_id: id,
            Categorie_id: catId
          }))
        });
      }
    }

    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId },
      select: { E_mail: true, Name: true }
    });

    await sendEmail('tool_updated', account.E_mail, account.Name, tool.Naam);

    res.json({ message: 'Gereedschap bijgewerkt!' });
  })
);


// ── DELETE ──
router.delete(
  '/gereedschap/:id',
  isLoggedIn,
  idParamValidator,
  validate,
  asyncHandler(async (req, res, next) => {

    const id = parseInt(req.params.id);

    const tool = await prisma.gereedschap.findUnique({
      where: { Gereedschap_id: id }
    });

    if (!tool || tool.Account_id !== req.session.userId) {
      return next(new AppError('Gereedschap niet gevonden of je hebt geen toegang', 403));
    }

    const chats = await prisma.chats.findMany({
      where: { Gereedschap_id: id },
      select: { Chat_id: true }
    });

    const chatIds = chats.map(c => c.Chat_id);

    if (chatIds.length > 0) {
      await prisma.berichten.deleteMany({
        where: { Chat_id: { in: chatIds } }
      });

      await prisma.chats.deleteMany({
        where: { Chat_id: { in: chatIds } }
      });
    }

    await prisma.uitleen.deleteMany({
      where: { Gereedschap_id: id }
    });

    await prisma.gereedschap_Categorie.deleteMany({
      where: { Gereedschap_id: id }
    });

    await prisma.gereedschap.delete({
      where: { Gereedschap_id: id }
    });

    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId },
      select: { E_mail: true, Name: true }
    });

    sendEmail('tool_deleted', account.E_mail, account.Name, tool.Naam)
      .catch(err =>
        console.error('E-mailnotificatie voor verwijdering mislukt:', err)
      );

    res.json({ message: 'Gereedschap verwijderd!' });
  })
);


// ── IMAGE UPLOAD ──
router.post(
  '/gereedschap/:id/afbeelding',
  isLoggedIn,
  idParamValidator,
  validate,
  upload.single('afbeelding'),
  asyncHandler(async (req, res, next) => {

    const id = parseInt(req.params.id);

    const tool = await prisma.gereedschap.findUnique({
      where: { Gereedschap_id: id }
    });

    if (!tool || tool.Account_id !== req.session.userId) {
      return next(new AppError('Gereedschap niet gevonden of je hebt geen toegang', 403));
    }

    if (!req.file) {
      return next(new AppError('Geen geldig afbeeldingsbestand ontvangen', 400));
    }

    const afbeeldingUrl = '/uploads/' + req.file.filename;

    await prisma.gereedschap.update({
      where: { Gereedschap_id: id },
      data: { Afbeelding: afbeeldingUrl }
    });

    res.json(toUploadAfbeeldingResponseDTO(afbeeldingUrl));
  })
);


// ── UPLOAD LOS ──
router.post(
  '/upload/afbeelding',
  isLoggedIn,
  upload.single('afbeelding'),
  asyncHandler(async (req, res, next) => {

    if (!req.file) {
      return next(new AppError('Geen geldig afbeeldingsbestand ontvangen', 400));
    }

    const afbeeldingUrl = '/uploads/' + req.file.filename;

    res.json(toUploadAfbeeldingResponseDTO(afbeeldingUrl));
  })
);

export default router;