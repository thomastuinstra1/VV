import { Router } from 'express';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { sendEmail } from '../utils/email.mjs';
import { upload } from '../middleware/upload.mjs';
import validate from '../middleware/validate.mjs';
import { gereedschapValidator } from '../validators/gereedschapValidator.mjs';
import { idParamValidator } from '../validators/idParamValidator.mjs';

const router = Router();

// ── Gereedschap aanmaken ──
router.post('/gereedschap', isLoggedIn, gereedschapValidator, validate, async (req, res) => {
  const { Naam, Beschrijving, Begindatum, Einddatum, BorgBedrag, Afbeelding, categorieen } = req.body;

  try {
    const tool = await prisma.gereedschap.create({
      data: {
        Naam,
        Beschrijving,
        Begindatum: Begindatum ? new Date(Begindatum) : null,
        Einddatum: Einddatum ? new Date(Einddatum) : null,
        BorgBedrag: BorgBedrag && BorgBedrag !== '' ? parseFloat(BorgBedrag) : null,
        Afbeelding,
        Account_id: req.session.userId
      }
    });

    if (categorieen && categorieen.length > 0) {
      await prisma.gereedschap_Categorie.createMany({
        data: categorieen.map(cat => ({
          Gereedschap_id: tool.Gereedschap_id,
          Categorie_id: cat
        }))
      });
    }

    res.json({ message: "Gereedschap opgeslagen!", id: tool.Gereedschap_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Opslaan mislukt" });
  }
});

// ── Gereedschap ophalen ──
router.get('/gereedschap', async (req, res) => {
  try {
    const { search, id, categorieen } = req.query;
    let where = {};

    if (search) {
      where.Naam = { contains: search };
    } else if (id) {
      where.Gereedschap_id = parseInt(id);
    }

    if (categorieen) {
      const catIds = categorieen.split(',').map(Number).filter(Boolean);
      if (catIds.length > 0) {
        where.Gereedschap_Categorie = { some: { Categorie_id: { in: catIds } } };
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
            Report_Report_GemeldToAccount: {
              select: { Report_id: true }
            }
          }
        }
      },
      orderBy: { Gereedschap_id: 'desc' }
    });

    res.json(tools);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ophalen gereedschap mislukt' });
  }
});

// ── Categorieën ophalen ──
router.get('/categorieen', async (req, res) => {
  try {
    const categorieen = await prisma.categorie.findMany();
    res.json(categorieen);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Categorieën ophalen mislukt" });
  }
});

// ── Mijn gereedschap ophalen ──
router.get('/mijn-gereedschap', isLoggedIn, async (req, res) => {
  try {
    const tools = await prisma.gereedschap.findMany({
      where: { Account_id: req.session.userId },
      orderBy: { Gereedschap_id: 'desc' }
    });
    res.json(tools);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ophalen mislukt' });
  }
});

// ── Categorieën van gereedschap ophalen ──
router.get('/gereedschap/:id/categorieen', idParamValidator, validate, async (req, res) => {
  try {
    const koppelingen = await prisma.gereedschap_Categorie.findMany({
      where: { Gereedschap_id: parseInt(req.params.id) }
    });
    res.json(koppelingen);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ophalen categorieën mislukt' });
  }
});

// ── Gereedschap bijwerken ──
router.put('/gereedschap/:id', isLoggedIn, idParamValidator, gereedschapValidator, validate, async (req, res) => {
  const id = parseInt(req.params.id);
  const { Naam, Beschrijving, BorgBedrag, Begindatum, Einddatum, categorieen } = req.body;

  try {
    const tool = await prisma.gereedschap.findUnique({ where: { Gereedschap_id: id } });
    if (!tool || tool.Account_id !== parseInt(req.session.userId)) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    await prisma.gereedschap.update({
      where: { Gereedschap_id: id },
      data: {
        Naam,
        Beschrijving,
        BorgBedrag: BorgBedrag ? parseFloat(BorgBedrag) : null,
        Begindatum: Begindatum ? new Date(Begindatum) : null,
        Einddatum: Einddatum ? new Date(Einddatum) : null
      }
    });

    if (categorieen !== undefined) {
      await prisma.gereedschap_Categorie.deleteMany({ where: { Gereedschap_id: id } });
      if (categorieen.length > 0) {
        await prisma.gereedschap_Categorie.createMany({
          data: categorieen.map(catId => ({
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Bijwerken mislukt' });
  }
});

// ── Gereedschap verwijderen ──
router.delete('/gereedschap/:id', isLoggedIn, idParamValidator, validate, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const tool = await prisma.gereedschap.findUnique({ where: { Gereedschap_id: id } });
    if (!tool || tool.Account_id !== parseInt(req.session.userId)) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    const chats = await prisma.chats.findMany({
      where: { Gereedschap_id: id },
      select: { Chat_id: true }
    });
    const chatIds = chats.map(c => c.Chat_id);

    if (chatIds.length > 0) {
      await prisma.berichten.deleteMany({ where: { Chat_id: { in: chatIds } } });
      await prisma.chats.deleteMany({ where: { Chat_id: { in: chatIds } } });
    }

    await prisma.uitleen.deleteMany({ where: { Gereedschap_id: id } });
    await prisma.gereedschap_Categorie.deleteMany({ where: { Gereedschap_id: id } });
    await prisma.gereedschap.delete({ where: { Gereedschap_id: id } });

    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId },
      select: { E_mail: true, Name: true }
    });

    res.json({ message: 'Gereedschap verwijderd!' });
    sendEmail('tool_deleted', account.E_mail, account.Name, tool.Naam).catch(console.error);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verwijderen mislukt' });
  }
});

// ── Afbeelding uploaden voor gereedschap ──
router.post('/gereedschap/:id/afbeelding', isLoggedIn, idParamValidator, validate, upload.single('afbeelding'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tool = await prisma.gereedschap.findUnique({ where: { Gereedschap_id: id } });

    if (!tool || tool.Account_id !== parseInt(req.session.userId)) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    const afbeeldingUrl = '/uploads/' + req.file.filename;
    await prisma.gereedschap.update({
      where: { Gereedschap_id: id },
      data: { Afbeelding: afbeeldingUrl }
    });
    res.json({ message: 'Afbeelding opgeslagen!', url: afbeeldingUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// ── Losse afbeelding uploaden ──
router.post('/upload/afbeelding', isLoggedIn, upload.single('afbeelding'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen geldig bestand' });
  const afbeeldingUrl = '/uploads/' + req.file.filename;
  res.json({ url: afbeeldingUrl });
});

export default router;