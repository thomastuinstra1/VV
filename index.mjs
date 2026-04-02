import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import prisma from './prismaClient.mjs';
import multer from 'multer';
import path from 'path';
import { Server } from "socket.io";
import http from "http";
import crypto from 'crypto';
import { postcodeNaarCoords } from './public/js/afstandfilter.js';

// ── Automatische e-mails via Apps Script ──
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

async function sendEmail(type, userEmail, userName, toolName = null) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, userEmail, userName, toolName })
    });
  } catch (err) {
    console.error('E-mail versturen mislukt:', err);
  }
}

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

function isLoggedIn(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ message: 'Niet ingelogd' });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const fileFilter = (req, file, cb) => {
  const toegestaan = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (toegestaan.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Alleen afbeeldingen zijn toegestaan'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});

// ── AUTH ROUTES ──

app.get('/auth-status', (req, res) => {
  res.json({ ingelogd: !!req.session.userId });
});

// FIX: Gecombineerde /register route (was dubbel gedefinieerd)
// Bevat: wachtwoord-hash, bestaanscheck, sessie én postcode-coördinaten
app.post('/register', async (req, res) => {
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
      data: {
        Name,
        E_mail,
        Password: hash,
        Postcode,
        lat: coords.lat,
        lon: coords.lon
      }
    });

    res.status(201).json({ message: 'Account aangemaakt!', id: account.Account_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

app.post('/login', async (req, res) => {
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

// FIX: Enkele /me route met isLoggedIn middleware (dubbele verwijderd)
app.get('/me', isLoggedIn, async (req, res) => {
  try {
    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId },
      select: { Account_id: true, Name: true, E_mail: true, Postcode: true, BSN: true, Afbeelding: true }
    });
    if (!account) return res.status(404).json({ message: 'User not found' });
    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Fout bij uitloggen' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Uitgelogd' });
  });
});

// ── WACHTWOORD RESET ROUTES ──

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const account = await prisma.account.findFirst({
      where: { E_mail: email }
    });

    if (!account) {
      return res.json({ message: 'Als dit e-mailadres bekend is, ontvang je een link.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: { resetToken: token, resetTokenExpiry: expiry }
    });

    const resetUrl = `${process.env.RESET_URL}?token=${token}`;

    await fetch(APPS_SCRIPT_URL, {
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

app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  try {
    const account = await prisma.account.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!account) {
      return res.status(400).json({ error: 'Ongeldige of verlopen link.' });
    }

    const hash = await bcrypt.hash(password, 10);

    await prisma.account.update({
      where: { Account_id: account.Account_id },
      data: {
        Password: hash,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ message: 'Wachtwoord succesvol gewijzigd!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

app.get('/Account', isLoggedIn, async (req, res) => {
  try {
    const accounts = await prisma.account.findMany();
    res.json(accounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

app.put('/account', isLoggedIn, async (req, res) => {
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

// ── GEREEDSCHAP ROUTES ──

app.post('/gereedschap', isLoggedIn, async (req, res) => {
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

app.get('/categorieen', async (req, res) => {
  try {
    const categorieen = await prisma.categorie.findMany();
    res.json(categorieen);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Categorieën ophalen mislukt" });
  }
});

// FIX: Enkele /gereedschap GET route met alle filters (dubbele verwijderd)
app.get('/gereedschap', async (req, res) => {
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
      include: { Account: true },
      orderBy: { Gereedschap_id: 'desc' }
    });

    res.json(tools);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ophalen gereedschap mislukt' });
  }
});

app.get('/mijn-gereedschap', isLoggedIn, async (req, res) => {
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

app.get('/gereedschap/:id/categorieen', async (req, res) => {
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

app.put('/gereedschap/:id', isLoggedIn, async (req, res) => {
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

app.delete('/gereedschap/:id', isLoggedIn, async (req, res) => {
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
    // FIX: sendEmail bewust na res.json() — fire-and-forget patroon, fout heeft geen invloed op response
    sendEmail('tool_deleted', account.E_mail, account.Name, tool.Naam).catch(console.error);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verwijderen mislukt' });
  }
});

// ── DASHBOARD ROUTES ──

app.get('/dashboard/uitleningen', isLoggedIn, async (req, res) => {
  try {
    const data = await prisma.uitleen.findMany({
      where: {
        Gereedschap: { Account_id: req.session.userId }
      },
      include: { Gereedschap: true }
    });

    // Haal alle unieke lener-IDs op en zoek hun namen in één query
    const lenerIds = [...new Set(data.map(u => u.Lener_id).filter(Boolean))];
    const leners = await prisma.account.findMany({
      where: { Account_id: { in: lenerIds } },
      select: { Account_id: true, Name: true, E_mail: true }
    });
    const lenerMap = Object.fromEntries(leners.map(l => [l.Account_id, l]));

    const mapped = data.map(u => ({
      Uitleen_id:      u.Uitleen_id,
      Status:          u.Status,
      StartDatum:      u.StartDatum,
      EindDatum:       u.EindDatum,
      BorgBedrag:      u.BorgBedrag,
      Account_id:      u.Account_id,
      Gereedschap_id:  u.Gereedschap_id,
      lenerNaam:       lenerMap[u.Lener_id]?.Name  || null,   // ← nu de echte lener
      lenerEmail:      lenerMap[u.Lener_id]?.E_mail || null,
      gereedschapNaam: u.Gereedschap?.Naam || null
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Dashboard uitleningen error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/dashboard/gereedschap', isLoggedIn, async (req, res) => {
  try {
    const now = new Date();

    const tools = await prisma.gereedschap.findMany({
      where: { Account_id: req.session.userId },
      include: {
        Uitleen: {
          where: {
            Status: { in: ['accepted', 'pending', 'te_laat', 'ingeleverd_op_tijd', 'ingeleverd_te_laat'] }
          },
          // FIX: Account includen zodat lenerNaam en lenerEmail beschikbaar zijn
          include: { Account: true },
          orderBy: { EindDatum: 'desc' }
        }
      }
    });

    const mapped = tools.map(g => {
      const actieveUitleen = g.Uitleen.find(u =>
        u.Status === 'accepted' || u.Status === 'pending' || u.Status === 'te_laat'
      );

      let dashboardStatus = 'Beschikbaar';
      let activeUitleenId = null;
      let lenerNaam = null;
      let lenerEmail = null;
      let eindDatum = null;

      if (actieveUitleen) {
        activeUitleenId = actieveUitleen.Uitleen_id;
        eindDatum = actieveUitleen.EindDatum;

        if (actieveUitleen.Status === 'pending') {
          dashboardStatus = 'Beschikbaar';
        } else if (actieveUitleen.Status === 'accepted') {
          const isOverDue = actieveUitleen.EindDatum && new Date(actieveUitleen.EindDatum) < now;
          const isStarted = actieveUitleen.StartDatum && new Date(actieveUitleen.StartDatum) <= now;
          dashboardStatus = isOverDue ? 'Ingeleverd?' : isStarted ? 'Uitgeleend' : 'Beschikbaar';
        } else if (actieveUitleen.Status === 'te_laat') {
          dashboardStatus = 'Te laat';
        }

        lenerNaam  = actieveUitleen.Account?.Name  || null;
        lenerEmail = actieveUitleen.Account?.E_mail || null;
      }

      return {
        Gereedschap_id:  g.Gereedschap_id,
        Naam:            g.Naam,
        Beschrijving:    g.Beschrijving,
        BorgBedrag:      g.BorgBedrag,
        Afbeelding:      g.Afbeelding,
        status:          dashboardStatus,
        activeUitleenId,
        lenerNaam,
        lenerEmail,
        eindDatum
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error('Dashboard gereedschap error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── UITLEEN STATUS BIJWERKEN ──

app.patch('/uitleen/:id/status', isLoggedIn, async (req, res) => {
  const uitleenId = parseInt(req.params.id);
  const { status } = req.body;

  const toegestaneStatussen = ['ingeleverd_op_tijd', 'ingeleverd_te_laat', 'te_laat'];
  if (!toegestaneStatussen.includes(status)) {
    return res.status(400).json({ error: 'Ongeldige status' });
  }

  try {
    const uitleen = await prisma.uitleen.findUnique({
      where: { Uitleen_id: uitleenId },
      include: { Gereedschap: true, Account: true }
    });

    if (!uitleen) {
      return res.status(404).json({ error: 'Uitleen niet gevonden' });
    }

    if (uitleen.Gereedschap.Account_id !== parseInt(req.session.userId)) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    await prisma.uitleen.update({
      where: { Uitleen_id: uitleenId },
      data: { Status: status }
    });

    if (uitleen.Account?.E_mail) {
      await sendEmail(
        status,
        uitleen.Account.E_mail,
        uitleen.Account.Name,
        uitleen.Gereedschap.Naam
      );
    }

    res.json({ message: 'Status bijgewerkt', status });
  } catch (err) {
    console.error('Status bijwerken mislukt:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── UITLEEN ROUTES ──

app.get('/uitleen/:id', isLoggedIn, async (req, res) => {
  try {
    const uitleen = await prisma.uitleen.findUnique({
      where: { Uitleen_id: parseInt(req.params.id) }
    });
    if (!uitleen) return res.status(404).json({ error: 'Afspraak niet gevonden' });
    res.json(uitleen);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ophalen uitleen mislukt' });
  }
});

// ── CHAT & BERICHTEN ROUTES ──

app.get('/mijn-chats', isLoggedIn, async (req, res) => {
  const userId = req.session.userId;
  try {
    const chats = await prisma.chats.findMany({
      where: {
        OR: [
          { SenderId: userId },
          { ReceiverId: userId }
        ]
      },
      include: {
        Account_Chats_SenderIdToAccount: true,
        Account_Chats_ReceiverIdToAccount: true,
        Gereedschap: true
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const mapped = chats.map(chat => {
      const partner = chat.SenderId === userId
        ? chat.Account_Chats_ReceiverIdToAccount
        : chat.Account_Chats_SenderIdToAccount;

      return {
        Chat_id:          chat.Chat_id,
        Account_id:       partner.Account_id,
        Name:             partner.Name,
        Afbeelding:       partner.Afbeelding,
        Gereedschap_id:   chat.Gereedschap_id,
        Gereedschap_naam: chat.Gereedschap?.Naam || ''
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ophalen mislukt' });
  }
});

app.post('/chat/start', isLoggedIn, async (req, res) => {
  const { partnerId, toolId } = req.body;
  const userId = req.session.userId;

  try {
    let chat = await prisma.chats.findFirst({
      where: {
        Gereedschap_id: toolId,
        OR: [
          { SenderId: userId, ReceiverId: partnerId },
          { SenderId: partnerId, ReceiverId: userId }
        ]
      }
    });

    let isNew = false;

    if (!chat) {
      chat = await prisma.chats.create({
        data: { SenderId: userId, ReceiverId: partnerId, Gereedschap_id: toolId }
      });
      isNew = true;

      const [sender, receiver] = await Promise.all([
        prisma.account.findUnique({ where: { Account_id: userId }, select: { Name: true } }),
        prisma.account.findUnique({ where: { Account_id: partnerId }, select: { Name: true, E_mail: true } })
      ]);

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_chat',
          receiverEmail: receiver.E_mail,
          receiverName: receiver.Name,
          senderName: sender.Name
        })
      }).catch(err => console.error('Email versturen mislukt:', err));
    }

    res.json({ ...chat, isNew });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chat starten mislukt' });
  }
});

app.get('/messages/chat/:chatId', isLoggedIn, async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  if (!chatId) return res.status(400).json({ error: 'Ongeldige chat ID' });

  try {
    const messages = await prisma.berichten.findMany({
      where: { Chat_id: chatId },
      orderBy: { id: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Berichten ophalen mislukt' });
  }
});

app.get('/chat/:chatId', isLoggedIn, async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  try {
    const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
    if (!chat) return res.status(404).json({ error: 'Chat niet gevonden' });
    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chat ophalen mislukt' });
  }
});

app.get('/messages/:userId', isLoggedIn, async (req, res) => {
  const currentUserId = req.session.userId;
  const otherUserId = parseInt(req.params.userId);
  if (!otherUserId) return res.status(400).json({ error: 'Ongeldige partner ID' });

  try {
    const messages = await prisma.berichten.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId }
        ]
      },
      orderBy: { id: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    console.error('Fout bij ophalen berichten:', err);
    res.status(500).json({ error: 'Kon berichten niet ophalen' });
  }
});

app.delete('/chat/:chatId', isLoggedIn, async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  const userId = req.session.userId;

  try {
    const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });

    if (!chat) return res.status(404).json({ error: 'Chat niet gevonden' });

    if (chat.SenderId !== userId && chat.ReceiverId !== userId) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    await prisma.berichten.deleteMany({ where: { Chat_id: chatId } });
    await prisma.chats.delete({ where: { Chat_id: chatId } });

    res.json({ message: 'Chat verwijderd' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verwijderen mislukt' });
  }
});

// ── AFBEELDING ROUTES ──

// FIX: eigenaarcheck toegevoegd zodat gebruikers niet elkaars afbeeldingen kunnen overschrijven
app.post('/gereedschap/:id/afbeelding', isLoggedIn, upload.single('afbeelding'), async (req, res) => {
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

app.post('/account/afbeelding', isLoggedIn, upload.single('afbeelding'), async (req, res) => {
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

app.post('/upload/afbeelding', isLoggedIn, upload.single('afbeelding'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen geldig bestand' });
  const afbeeldingUrl = '/uploads/' + req.file.filename;
  res.json({ url: afbeeldingUrl });
});

// ── SERVER & SOCKET.IO ──

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  const userId = socket.handshake.auth.userId;

  if (!userId) {
    console.log("Geen userId, verbinding verbroken");
    socket.disconnect();
    return;
  }

  console.log(`User ${userId} verbonden via Socket.IO`);
  socket.join(userId);

  socket.on("join_chat", ({ chatId }) => {
    socket.join(`chat_${chatId}`);
    console.log(`User ${userId} joined chat_${chatId}`);
  });

  socket.on("start_chat", async ({ partnerId, toolId }) => {
    try {
      let chat = await prisma.chats.findFirst({
        where: {
          Gereedschap_id: toolId,
          OR: [
            { SenderId: userId, ReceiverId: partnerId },
            { SenderId: partnerId, ReceiverId: userId }
          ]
        }
      });

      if (!chat) {
        chat = await prisma.chats.create({
          data: { SenderId: userId, ReceiverId: partnerId, Gereedschap_id: toolId }
        });
      }

      socket.join(`chat_${chat.Chat_id}`);
      io.to(`chat_${chat.Chat_id}`).emit("chat_started", chat);
    } catch (err) {
      console.error("Fout bij starten chat:", err);
    }
  });

  socket.on("send_message", async ({ chatId, content }) => {
    try {
      const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
      if (!chat) return;

      const toUserId = chat.SenderId === userId ? chat.ReceiverId : chat.SenderId;

      const message = await prisma.berichten.create({
        data: {
          senderId: userId,
          receiverId: toUserId,
          content,
          Chat_id: chatId,
          type: "text"
        }
      });

      io.to(`chat_${chatId}`).emit("receive_message", message);
    } catch (err) {
      console.error("Fout bij versturen bericht:", err);
    }
  });

  socket.on("send_appointment", async ({ chatId, startDate, endDate }) => {
    try {
      const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
      if (!chat) return;

      const toUserId = chat.SenderId === userId ? chat.ReceiverId : chat.SenderId;

      const tool = await prisma.gereedschap.findUnique({
        where: { Gereedschap_id: chat.Gereedschap_id }
      });

      const overlap = await prisma.uitleen.findFirst({
        where: {
          Gereedschap_id: tool.Gereedschap_id,
          Status: { in: ['pending', 'accepted'] },
          StartDatum: { lte: new Date(endDate) },
          EindDatum:  { gte: new Date(startDate) }
        }
      });

      if (overlap) {
        socket.emit("appointment_error", {
          message: "Dit gereedschap is al uitgeleend in deze periode."
        });
        return;
      }

      const lenerId = userId === tool.Account_id ? toUserId : userId;

      const uitleen = await prisma.uitleen.create({
        data: {
          Account_id:     tool.Account_id,
          Lener_id:       lenerId,
          Gereedschap_id: tool.Gereedschap_id,
          StartDatum:     new Date(startDate),
          EindDatum:      new Date(endDate),
          BorgBedrag:     tool.BorgBedrag ?? 0,
          Status:         "pending"
        }
      });

      const message = await prisma.berichten.create({
        data: {
          senderId:   userId,
          receiverId: toUserId,
          content:    "Afspraak verzoek",
          type:       "appointment",
          Chat_id:    chatId,
          uitleenId:  uitleen.Uitleen_id
        }
      });

      io.to(`chat_${chatId}`).emit("receive_message", message);
    } catch (err) {
      console.error("Fout bij afspraak:", err);
    }
  });

  socket.on("respond_appointment", async ({ uitleenId, action }) => {
    try {
      const status = action === "accept" ? "accepted" : "rejected";
      const updated = await prisma.uitleen.update({
        where: { Uitleen_id: uitleenId },
        data: { Status: status }
      });

      const bericht = await prisma.berichten.findFirst({
        where: { uitleenId: uitleenId }
      });

      if (bericht) {
        io.to(`chat_${bericht.Chat_id}`).emit("appointment_updated", updated);
      }
    } catch (err) {
      console.error("Fout bij reageren op afspraak:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User ${userId} heeft verbinding verbroken`);
  });
});

  // ── LENER DASHBOARD ROUTE ─────────────────────────────────────────────────
app.get('/mijn-leningen', isLoggedIn, async (req, res) => {
  try {
    const uitleningen = await prisma.uitleen.findMany({
      where: {
        Lener_id: req.session.userId
      },
      include: {
        Gereedschap: {
          include: {
            Account: {
              select: { Account_id: true, Name: true, E_mail: true }
            }
          }
        }
      },
      orderBy: { EindDatum: 'asc' }
    });

    // Haal chats op zodat we de Chat_id kunnen meegeven per lening
    const chatList = await prisma.chats.findMany({
      where: {
        OR: [
          { SenderId: req.session.userId },
          { ReceiverId: req.session.userId }
        ]
      },
      select: { Chat_id: true, SenderId: true, ReceiverId: true, Gereedschap_id: true }
    });

    const mapped = uitleningen.map(u => {
      const tool     = u.Gereedschap;
      const eigenaar = tool?.Account;

      // Zoek de bijbehorende chat op basis van gereedschap + gesprekspartner (eigenaar)
      const chat = chatList.find(c =>
        c.Gereedschap_id === u.Gereedschap_id &&
        (c.SenderId === eigenaar?.Account_id || c.ReceiverId === eigenaar?.Account_id)
      );

      return {
        Uitleen_id:      u.Uitleen_id,
        Status:          u.Status,
        StartDatum:      u.StartDatum,
        EindDatum:       u.EindDatum,
        BorgBedrag:      u.BorgBedrag,
        Gereedschap_id:  u.Gereedschap_id,
        gereedschapNaam: tool?.Naam    || null,
        Afbeelding:      tool?.Afbeelding || null,
        eigenaarNaam:    eigenaar?.Name  || null,
        eigenaarEmail:   eigenaar?.E_mail || null,
        Chat_id:         chat?.Chat_id   || null
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error('Mijn leningen error:', err);
    res.status(500).json({ error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server draait op https://${HOST}:${PORT}`);
});
