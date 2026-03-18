import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import prisma from './prismaClient.mjs';
import multer from 'multer';
import path from 'path';
import { Server } from "socket.io";
import http from "http";

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Sessie configuratie
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true, // zet op true bij HTTPS
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

// Registreren
app.post('/register', async (req, res) => {
  const { Name, E_mail, Password, Postcode } = req.body;

  try {
    // Controleer of Name of E_mail al bestaat
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
      data: {
        Name: Name,
        E_mail: E_mail,
        Password: hash,
        Postcode: Postcode
      }
    });

    res.status(201).json({ message: 'Account aangemaakt!', id: account.Account_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// Login met Name of E_mail
app.post('/login', async (req, res) => {
  const { login, Password } = req.body; // 'login' kan Name of E_mail zijn

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

// Uitloggen
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Fout bij uitloggen' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Uitgelogd' });
  });
});

// Accounts ophalen (nu beveiligd)
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
            data: data
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
        Naam: Naam,
        Beschrijving: Beschrijving,
        Begindatum: Begindatum ? new Date(Begindatum) : null,
        Einddatum: Einddatum ? new Date(Einddatum) : null,
        BorgBedrag: BorgBedrag && BorgBedrag !== '' ? parseFloat(BorgBedrag) : null,
        Afbeelding: Afbeelding,
        Account_id: req.session.userId
      }
    });

    // categorie koppelingen maken
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

app.get('/categorieen', async (req,res)=>{
  try {
    const categorieen = await prisma.categorie.findMany();
    res.json(categorieen);
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Categorieën ophalen mislukt"});
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
        where.Gereedschap_Categorie = {
          some: {
            Categorie_id: { in: catIds }
          }
        };
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

// ============================================================
// Voeg deze 3 routes toe aan server.js
// (voor de app.listen regel onderaan)
// ============================================================

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
    // Controleer of dit gereedschap van de ingelogde gebruiker is
    const tool = await prisma.gereedschap.findUnique({
      where: { Gereedschap_id: id }
    });

    if (!tool || tool.Account_id !== req.session.userId) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    // Update de velden
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

    // Categorieën bijwerken: verwijder oude, voeg nieuwe toe
    if (categorieen !== undefined) {
      await prisma.gereedschap_Categorie.deleteMany({
        where: { Gereedschap_id: id }
      });

      if (categorieen.length > 0) {
        await prisma.gereedschap_Categorie.createMany({
          data: categorieen.map(catId => ({
            Gereedschap_id: id,
            Categorie_id: catId
          }))
        });
      }
    }

    res.json({ message: 'Gereedschap bijgewerkt!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Bijwerken mislukt' });
  }
});

// listen altijd als laatste
const server = http.createServer(app);

// Socket.IO setup
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
  socket.join(userId); // iedere gebruiker in eigen “room”

  // Berichten versturen
  socket.on("send_message", async (data) => {
    const { content, toUserId } = data;
    const fromUserId = userId;

    try {
      const message = await prisma.berichten.create({
        data: { content, senderId: fromUserId, receiverId: toUserId }
      });

      io.to(toUserId).emit("receive_message", message); // naar ontvanger
      socket.emit("receive_message", message); // terug naar verzender
    } catch (err) {
      console.error("Fout bij versturen bericht:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User ${userId} heeft verbinding verbroken`);
  });
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

server.listen(PORT, HOST, () => {
  console.log(`Server draait op https://${HOST}:${PORT}`);
});

