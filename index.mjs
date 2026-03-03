import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import prisma from './prismaClient.mjs';

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Sessie configuratie
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // zet op true bij HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 24 uur
  }
}));

// Middleware: controleer of gebruiker ingelogd is
function isLoggedIn(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ message: 'Niet ingelogd' });
}

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

    res.json({ message: 'Ingelogd!', Name: account.Name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Er is iets misgegaan' });
  }
});

// Huidige ingelogde gebruiker ophalen
app.get('/me', isLoggedIn, (req, res) => {
  res.json({ userId: req.session.userId, Name: req.session.Name });
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
    const { Name, E_mail, Postcode, Password } = req.body;

    try {
        const data = {};
        if (Name) data.Name = Name;
        if (E_mail) data.E_mail = E_mail;
        if (Postcode) data.Postcode = Postcode;
        if (Password) data.Password = await bcrypt.hash(Password, 10);

        const account = await prisma.account.update({
            where: { Account_id: req.session.userId },
            data: data
        });

        if (Name) req.session.Name = account.Name;

        console.log(`✅ Account bijgewerkt voor gebruiker: ${account.Name} (ID: ${account.Account_id})`);

        res.json({ message: 'Gegevens bijgewerkt!', Name: account.Name });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Er is iets misgegaan' });
    }
});

// ✅ listen altijd als laatste
app.listen(PORT, HOST, () => {
  console.log(`Server draait op http://${HOST}:${PORT}`);
});

