import { Router } from 'express';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import { sendEmail } from '../utils/email.mjs';
import validate from '../middleware/validate.mjs';
import { uitleenValidator } from '../validators/uitleenValidator.mjs';

const router = Router();

// ── Uitleen ophalen ──
router.get('/uitleen/:id', isLoggedIn, async (req, res) => {
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

// ── Uitleen status bijwerken ──
router.patch('/uitleen/:id/status', isLoggedIn, async (req, res) => {
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

    if (!uitleen) return res.status(404).json({ error: 'Uitleen niet gevonden' });

    if (uitleen.Gereedschap.Account_id !== parseInt(req.session.userId)) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    await prisma.uitleen.update({
      where: { Uitleen_id: uitleenId },
      data: { Status: status }
    });

    if (uitleen.Account?.E_mail) {
      await sendEmail(status, uitleen.Account.E_mail, uitleen.Account.Name, uitleen.Gereedschap.Naam);
    }

    res.json({ message: 'Status bijgewerkt', status });
  } catch (err) {
    console.error('Status bijwerken mislukt:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Dashboard: uitleningen van mijn gereedschap ──
router.get('/dashboard/uitleningen', isLoggedIn, async (req, res) => {
  try {
    const data = await prisma.uitleen.findMany({
      where: { Gereedschap: { Account_id: req.session.userId } },
      include: { Gereedschap: true }
    });

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
      lenerNaam:       lenerMap[u.Lener_id]?.Name  || null,
      lenerEmail:      lenerMap[u.Lener_id]?.E_mail || null,
      gereedschapNaam: u.Gereedschap?.Naam || null
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Dashboard uitleningen error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Dashboard: mijn gereedschap met status ──
router.get('/dashboard/gereedschap', isLoggedIn, async (req, res) => {
  try {
    const now = new Date();

    const tools = await prisma.gereedschap.findMany({
      where: { Account_id: req.session.userId },
      include: {
        Uitleen: {
          where: {
            Status: { in: ['accepted', 'pending', 'te_laat', 'ingeleverd_op_tijd', 'ingeleverd_te_laat'] }
          },
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

// ── Mijn leningen (lener dashboard) ──
router.get('/mijn-leningen', isLoggedIn, async (req, res) => {
  try {
    const uitleningen = await prisma.uitleen.findMany({
      where: { Lener_id: req.session.userId },
      include: {
        Gereedschap: {
          include: {
            Account: { select: { Account_id: true, Name: true, E_mail: true } }
          }
        }
      },
      orderBy: { EindDatum: 'asc' }
    });

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
      const lenerId  = req.session.userId;

      const chat = chatList.find(c =>
        c.Gereedschap_id === u.Gereedschap_id &&
        (
          (c.SenderId === lenerId && c.ReceiverId === eigenaar?.Account_id) ||
          (c.SenderId === eigenaar?.Account_id && c.ReceiverId === lenerId)
        )
      );

      return {
        Uitleen_id:      u.Uitleen_id,
        Status:          u.Status,
        StartDatum:      u.StartDatum,
        EindDatum:       u.EindDatum,
        BorgBedrag:      u.BorgBedrag,
        Gereedschap_id:  u.Gereedschap_id,
        gereedschapNaam: tool?.Naam       || null,
        Afbeelding:      tool?.Afbeelding || null,
        eigenaarId:      eigenaar?.Account_id || null,
        eigenaarNaam:    eigenaar?.Name   || null,
        eigenaarEmail:   eigenaar?.E_mail || null,
        Chat_id:         chat?.Chat_id    || null
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error('Mijn leningen error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Nieuwe uitleen aanmaken ──
router.post('/uitleen', isLoggedIn, uitleenValidator, validate, async (req, res) => {
  const { gereedschapId, gebruikerId, startDatum, eindDatum } = req.body;
  try {
    const uitleen = await prisma.uitleen.create({
      data: {
        Gereedschap_id: gereedschapId,
        Lener_id:       gebruikerId,
        Account_id:     req.session.userId,
        StartDatum:     new Date(startDatum),
        EindDatum:      new Date(eindDatum),
        Status:         'pending'
      }
    });
    res.status(201).json({ message: 'Uitleen aangemaakt!', id: uitleen.Uitleen_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Aanmaken mislukt' });
  }
});

export default router;