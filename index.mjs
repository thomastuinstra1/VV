import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import prisma from './prismaClient.mjs';
import multer from 'multer';
import path from 'path';


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
      select: { Name: true, E_mail: true, Postcode: true, BSN: true, Afbeelding: true }
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
  const { Categorie_id, Naam, Beschrijving, Staat, Beschikbaar, BorgBedrag, Afbeelding } = req.body;

  try {
    const tool = await prisma.gereedschap.create({
      data: {
        Categorie_id: Categorie_id ? parseInt(Categorie_id) : null,
        Naam: Naam,
        Beschrijving: Beschrijving,
        Staat: Staat,
        Beschikbaar: Beschikbaar === "true",
        BorgBedrag: BorgBedrag ? parseFloat(BorgBedrag) : null,
        Afbeelding: Afbeelding
      }
    });

    console.log(`Nieuw gereedschap toegevoegd: ${tool.Naam}`);

    res.json({ message: "Gereedschap opgeslagen!", tool });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Opslaan mislukt" });
  }
});

app.get('/categorieen', async (req,res)=>{
  const cat = await prisma.categorie.findMany();
  res.json(cat);
});

// listen altijd als laatste
app.listen(PORT, HOST, () => {
  console.log(`Server draait op http://${HOST}:${PORT}`);
});

