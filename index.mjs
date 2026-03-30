import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import prisma from './prismaClient.mjs';
import multer from 'multer';
import path from 'path';
import { Server } from "socket.io";
import http from "http";

// ── Automatische e-mails via Apps Script ──
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxo_EldpTHSCZIw2Nq8B64RjtlaWjCoSlUGS-LLGt-hCfRFhfDdYFSr_EazJe6u--qeYQ/exec';

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

// Sessie configuratie
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 24 uur
  }
}));

// Middleware: controleer of gebruiker ingelogd is
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
  limits: { fileSize: 2 * 1024 * 1024 } // max 2MB
});

app.post('/gereedschap/:id/afbeelding', isLoggedIn, upload.single('afbeelding'), async (req, res) => {
  try {
    const afbeeldingUrl = '/uploads/' + req.file.filename;
    await prisma.gereedschap.update({
      where: { Gereedschap_id: parseInt(req.params.id) },
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

app.get('/auth-status', (req, res) => {
  res.json({ ingelogd: !!req.session.userId });
});

// Registreren
app.post('/register', async (req, res) => {
  const { Name, E_mail, Password, Postcode } = req.body;
  try {
    const bestaand = await prisma.account.findFirst({
      where: {
        OR: [
          { Name: Name },
          { E_mail: E_mail }
        ]
      }
    });

    if (bestaand) {
      return res.status(400).json({ message: 'Naam of e-mail is al in gebruik' });
    }

    const hash = await bcrypt.hash(Password, 10);
    const account = await prisma.account.create({
      data: { Name, E_mail, Password: hash, Postcode }
    });

    res.status(201).json({ message: 'Account aangemaakt!', id: account.Account_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// Login met Name of E_mail
app.post('/login', async (req, res) => {
  const { login, Password } = req.body;
  try {
    const account = await prisma.account.findFirst({
      where: {
        OR: [
          { Name: login },
          { E_mail: login }
        ]
      }
    });

    if (!account) {
      return res.status(401).json({ message: 'Gebruiker niet gevonden' });
    }

    const geldig = await bcrypt.compare(Password, account.Password);
    if (!geldig) {
      return res.status(401).json({ message: 'Ongeldig wachtwoord' });
    }

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

// Huidige ingelogde gebruiker ophalen
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

// Gereedschap verwijderen
app.delete('/gereedschap/:id', isLoggedIn, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const tool = await prisma.gereedschap.findUnique({ where: { Gereedschap_id: id } });

    if (!tool || tool.Account_id !== req.session.userId) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    await prisma.gereedschap_Categorie.deleteMany({ where: { Gereedschap_id: id } });
    await prisma.gereedschap.delete({ where: { Gereedschap_id: id } });

    const account = await prisma.account.findUnique({
      where: { Account_id: req.session.userId },
      select: { E_mail: true, Name: true }
    });
    await sendEmail('tool_deleted', account.E_mail, account.Name, tool.Naam);

    res.json({ message: 'Gereedschap verwijderd!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Verwijderen mislukt' });
  }
});

// Alle unieke gesprekspartners ophalen
app.get('/mijn-chats', isLoggedIn, async (req, res) => {
  const userId = req.session.userId;
  try {
    const berichten = await prisma.berichten.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      orderBy: { id: 'desc' }
    });

    const partnerIds = [...new Set(
      berichten.map(b => b.senderId === userId ? b.receiverId : b.senderId)
    )];

    const partners = await prisma.account.findMany({
      where: { Account_id: { in: partnerIds } },
      select: { Account_id: true, Name: true, Afbeelding: true }
    });

    res.json(partners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ophalen mislukt' });
  }
});

// Uitloggen
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Fout bij uitloggen' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Uitgelogd' });
  });
});

// Accounts ophalen
app.get('/Account', isLoggedIn, async (req, res) => {
  try {
    const accounts = await prisma.account.findMany();
    res.json(accounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// Account gegevens aanpassen
app.put('/account', isLoggedIn, async (req, res) => {
  const { Name, E_mail, Postcode, Password, BSN } = req.body;
  try {
    const data = {};
    if (Name) data.Name = Name;
    if (E_mail) data.E_mail = E_mail;
    if (Postcode) data.Postcode = Postcode;
    if (Password) data.Password = await bcrypt.hash(Password, 10);
    if (BSN) data.BSN = BSN;

    const account = await prisma.account.update({
      where: { Account_id: req.session.userId },
      data
    });

    if (Name) req.session.Name = account.Name;
    console.log(`Account bijgewerkt voor gebruiker: ${account.Name} (ID: ${account.Account_id})`);
    res.json({ message: 'Gegevens bijgewerkt!', Name: account.Name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// Gereedschap toevoegen
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

    res.json({ message: "Gereedschap opgeslagen!" });
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

// Alle gereedschappen ophalen
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
      orderBy: { Gereedschap_id: 'desc' }
    });

    res.json(tools);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ophalen gereedschap mislukt' });
  }
});

// Mijn eigen gereedschap ophalen
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

// Categorieën van één gereedschap ophalen
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

// Gereedschap bewerken
app.put('/gereedschap/:id', isLoggedIn, async (req, res) => {
  const id = parseInt(req.params.id);
  const { Naam, Beschrijving, BorgBedrag, Begindatum, Einddatum, categorieen } = req.body;

  try {
    const tool = await prisma.gereedschap.findUnique({ where: { Gereedschap_id: id } });

    if (!tool || tool.Account_id !== req.session.userId) {
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

// ── DASHBOARD ROUTES ──

app.get('/dashboard/uitleningen', async (req, res) => {
  const data = await prisma.uitleen.findMany({
    include: { Account: true, Gereedschap: true }
  });

  const mapped = data.map(u => ({
    Uitleen_id: u.Uitleen_id,
    Status: u.Status,
    StartDatum: u.StartDatum,
    EindDatum: u.EindDatum,
    RetourDatum: u.RetourDatum,
    BorgBedrag: u.BorgBedrag,
    Kosten: u.Kosten,
    Account_id: u.Account_id,
    Gereedschap_id: u.Gereedschap_id,
    lenerNaam: u.Account?.Name || null,
    gereedschapNaam: u.Gereedschap?.Naam || null
  }));

  res.json(mapped);
});

app.get('/dashboard/gereedschap', async (req, res) => {
  const tools = await prisma.gereedschap.findMany({
    include: {
      Uitleen: {
        where: { Status: { in: ['Uitgeleend', 'Te laat'] } }
      }
    }
  });

  const mapped = tools.map(g => ({
    Gereedschap_id: g.Gereedschap_id,
    Naam: g.Naam,
    Beschrijving: g.Beschrijving,
    BorgBedrag: g.BorgBedrag,
    status: g.Beschikbaar
      ? 'Beschikbaar'
      : (g.Uitleen[0]?.Status || 'Beschikbaar')
  }));

  res.json(mapped);
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

// Nieuwe chat starten of bestaande ophalen
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

    if (!chat) {
      chat = await prisma.chats.create({
        data: { SenderId: userId, ReceiverId: partnerId, Gereedschap_id: toolId }
      });
    }

    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chat starten mislukt' });
  }
});

// Berichten ophalen per chat
app.get('/messages/chat/:chatId', isLoggedIn, async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  if (!chatId) return res.status(400).json({ error: 'Ongeldige chat ID' });

  try {
    const messages = await prisma.berichten.findMany({
      where: { chatId },
      orderBy: { id: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Berichten ophalen mislukt' });
  }
});

// Specifieke chat ophalen
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

// Berichten ophalen per gebruiker (oud endpoint — behouden voor compatibiliteit)
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

// ── SERVER & SOCKET.IO ──

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://gereedschapspunt.student.open-ict.hu/index.html",
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

  // Chat starten of ophalen
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

  // Normaal bericht versturen
  socket.on("send_message", async ({ chatId, content }) => {
    try {
      const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
      if (!chat) return;

      const toUserId = chat.SenderId === userId ? chat.ReceiverId : chat.SenderId;

      const message = await prisma.berichten.create({
        data: { senderId: userId, receiverId: toUserId, content, chatId, type: "text" }
      });

      io.to(`chat_${chatId}`).emit("receive_message", message);
    } catch (err) {
      console.error("Fout bij versturen bericht:", err);
    }
  });

  // Afspraak versturen
  socket.on("send_appointment", async ({ chatId, borg, startDate, endDate }) => {
    try {
      const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
      if (!chat) return;

      const toUserId = chat.SenderId === userId ? chat.ReceiverId : chat.SenderId;

      const tool = await prisma.gereedschap.findUnique({
        where: { Gereedschap_id: chat.Gereedschap_id }
      });

      const uitleen = await prisma.uitleen.create({
        data: {
          Account_id: tool.Account_id,
          Lener_id: userId,
          Gereedschap_id: tool.Gereedschap_id,
          StartDatum: new Date(startDate),
          Einddatum: new Date(endDate),
          BorgBedrag: parseFloat(borg),
          Status: "pending"
        }
      });

      const message = await prisma.berichten.create({
        data: {
          senderId: userId,
          receiverId: toUserId,
          content: "Afspraak verzoek",
          type: "appointment",
          chatId,
          uitleenId: uitleen.Uitleen_id
        }
      });

      io.to(`chat_${chatId}`).emit("receive_message", message);
    } catch (err) {
      console.error("Fout bij afspraak:", err);
    }
  });

  // Accepteren / weigeren afspraak
  socket.on("respond_appointment", async ({ uitleenId, action }) => {
    try {
      const status = action === "accept" ? "accepted" : "rejected";
      const updated = await prisma.uitleen.update({
        where: { Uitleen_id: uitleenId },
        data: { Status: status }
      });

      if (updated.Chat_id) {
        io.to(`chat_${updated.Chat_id}`).emit("appointment_updated", updated);
      }
    } catch (err) {
      console.error("Fout bij reageren op afspraak:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User ${userId} heeft verbinding verbroken`);
  });
});

//hallo
server.listen(PORT, HOST, () => {
  console.log(`Server draait op https://${HOST}:${PORT}`);
});
