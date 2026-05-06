import { Router } from 'express';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';

const router = Router();

const AFGEROND = ['ingeleverd_op_tijd', 'ingeleverd_te_laat'];

// ─── GET /account/:id/reviews  (reviews ontvangen als verhuurder) ─────────────
router.get('/account/:id/reviews', async (req, res) => {
  const ontvangerID = parseInt(req.params.id);
  if (isNaN(ontvangerID)) return res.status(400).json({ error: 'Ongeldig id' });

  try {
    const reviews = await prisma.review.findMany({
      where: { Ontvanger_id: ontvangerID },
      include: {
        Account_Review_Auteur_idToAccount: {
          select: { Account_id: true, Name: true, Afbeelding: true },
        },
        Uitleen: {
          select: { Account_id: true, Lener_id: true },
        },
      },
      orderBy: { Datum: 'desc' },
    });

    // Verhuurder-review: ontvanger was de VERHUURDER (Account_id) in die uitleen
    const verhuurderReviews = reviews.filter(
      (r) => r.Uitleen?.Account_id === ontvangerID
    );

    res.json(verhuurderReviews.map((r) => ({
      Review_id:        r.Review_id,
      Uitleen_id:       r.Uitleen_id,
      Auteur_id:        r.Auteur_id,
      auteurNaam:       r.Account_Review_Auteur_idToAccount?.Name ?? 'Onbekend',
      auteurAfbeelding: r.Account_Review_Auteur_idToAccount?.Afbeelding ?? null,
      Tekst:            r.Tekst,
      Rating:           r.Rating,
      Datum:            r.Datum,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij ophalen reviews' });
  }
});

// ─── GET /account/:id/lener-reviews  (reviews ontvangen als lener) ───────────
router.get('/account/:id/lener-reviews', async (req, res) => {
  const ontvangerID = parseInt(req.params.id);
  if (isNaN(ontvangerID)) return res.status(400).json({ error: 'Ongeldig id' });

  try {
    const reviews = await prisma.review.findMany({
      where: { Ontvanger_id: ontvangerID },
      include: {
        Account_Review_Auteur_idToAccount: {
          select: { Account_id: true, Name: true, Afbeelding: true },
        },
        Uitleen: {
          select: { Account_id: true, Lener_id: true }, // Lener_id toevoegen
        },
      },
      orderBy: { Datum: 'desc' },
    });

    // Lener-review: ontvanger was de LENER in die uitleen
    const lenerReviews = reviews.filter(
      (r) => r.Uitleen?.Lener_id === ontvangerID
    );

    res.json(lenerReviews.map((r) => ({
      Review_id:        r.Review_id,
      Uitleen_id:       r.Uitleen_id,
      Auteur_id:        r.Auteur_id,
      auteurNaam:       r.Account_Review_Auteur_idToAccount?.Name ?? 'Onbekend',
      auteurAfbeelding: r.Account_Review_Auteur_idToAccount?.Afbeelding ?? null,
      Tekst:            r.Tekst,
      Rating:           r.Rating,
      Datum:            r.Datum,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij ophalen lener-reviews' });
  }
});

// GET /uitlenen/te-reviewen?verhuurder=<id>
router.get('/uitlenen/te-reviewen', isLoggedIn, async (req, res) => {
  const lenerId    = req.session.userId;
  const verhuurder = parseInt(req.query.verhuurder);

  if (isNaN(verhuurder)) return res.status(400).json({ error: 'Ongeldige verhuurder id' });

  try {
    const uitlenen = await prisma.uitleen.findMany({
      where: {
        Lener_id:   lenerId,
        Account_id: verhuurder,
        Status:     { in: AFGEROND },
        Review:     { none: { Auteur_id: lenerId } },
      },
      include: { Gereedschap: { select: { Naam: true } } },
      orderBy: { EindDatum: 'desc' },
    });

    res.json(uitlenen.map((u) => ({
      Uitleen_id:      u.Uitleen_id,
      gereedschapNaam: u.Gereedschap?.Naam ?? null,
      EindDatum:       u.EindDatum,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij ophalen uitlenen' });
  }
});

// ─── GET /uitlenen/als-verhuurder-te-reviewen?lener=<id> ─────────────────────
// Afgeronde uitlenen waarbij de ingelogde gebruiker verhuurder is
// en de opgegeven lener heeft geleend — nog geen review geschreven
router.get('/uitlenen/als-verhuurder-te-reviewen', isLoggedIn, async (req, res) => {
  const verhuurder = req.session.userId;
  const lenerId    = parseInt(req.query.lener);

  if (isNaN(lenerId)) return res.status(400).json({ error: 'Ongeldige lener id' });

  try {
    const uitlenen = await prisma.uitleen.findMany({
      where: {
        Account_id: verhuurder,
        Lener_id:   lenerId,
        Status:     { in: AFGEROND },
        Review:     { none: { Auteur_id: verhuurder } },
      },
      include: { Gereedschap: { select: { Naam: true } } },
      orderBy: { EindDatum: 'desc' },
    });

    res.json(uitlenen.map((u) => ({
      Uitleen_id:      u.Uitleen_id,
      gereedschapNaam: u.Gereedschap?.Naam ?? null,
      EindDatum:       u.EindDatum,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij ophalen uitlenen' });
  }
});

// ─── POST /reviews ────────────────────────────────────────────────────────────
router.post('/reviews', isLoggedIn, async (req, res) => {
  const auteurId = req.session.userId;
  const { Uitleen_id, Ontvanger_id, Tekst, Rating } = req.body;

  if (!Uitleen_id || !Ontvanger_id || !Rating) {
    return res.status(400).json({ error: 'Uitleen_id, Ontvanger_id en Rating zijn verplicht' });
  }
  if (Rating < 1 || Rating > 5) {
    return res.status(400).json({ error: 'Rating moet tussen 1 en 5 zijn' });
  }

  try {
    const uitleen = await prisma.uitleen.findUnique({
      where: { Uitleen_id: parseInt(Uitleen_id) },
    });

    if (!uitleen) return res.status(404).json({ error: 'Uitleen niet gevonden' });
    if (uitleen.Lener_id !== auteurId && uitleen.Account_id !== auteurId) {
      return res.status(403).json({ error: 'Geen toegang tot deze uitleen' });
    }
    if (!AFGEROND.includes(uitleen.Status)) {
      return res.status(400).json({ error: 'Uitleen moet afgerond zijn om te reviewen' });
    }

    const bestaand = await prisma.review.findFirst({
      where: { Uitleen_id: parseInt(Uitleen_id), Auteur_id: auteurId },
    });
    if (bestaand) {
      return res.status(409).json({ error: 'Je hebt deze uitleen al beoordeeld' });
    }

    const review = await prisma.review.create({
      data: {
        Uitleen_id:   parseInt(Uitleen_id),
        Auteur_id:    auteurId,
        Ontvanger_id: parseInt(Ontvanger_id),
        Tekst:        Tekst?.trim() || null,
        Rating:       parseInt(Rating),
        Datum:        new Date(),
      },
    });

    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij aanmaken review' });
  }
});

// ─── PUT /reviews/:id ─────────────────────────────────────────────────────────
router.put('/reviews/:id', isLoggedIn, async (req, res) => {
  const reviewId = parseInt(req.params.id);
  const auteurId = req.session.userId;
  const { Tekst, Rating } = req.body;

  if (isNaN(reviewId)) return res.status(400).json({ error: 'Ongeldig id' });
  if (Rating && (Rating < 1 || Rating > 5)) {
    return res.status(400).json({ error: 'Rating moet tussen 1 en 5 zijn' });
  }

  try {
    const review = await prisma.review.findUnique({ where: { Review_id: reviewId } });

    if (!review) return res.status(404).json({ error: 'Review niet gevonden' });
    if (review.Auteur_id !== auteurId) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    const updated = await prisma.review.update({
      where: { Review_id: reviewId },
      data: {
        ...(Tekst  !== undefined && { Tekst:  Tekst.trim() || null }),
        ...(Rating !== undefined && { Rating: parseInt(Rating) }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij bewerken review' });
  }
});

// ─── DELETE /reviews/:id ──────────────────────────────────────────────────────
router.delete('/reviews/:id', isLoggedIn, async (req, res) => {
  const reviewId = parseInt(req.params.id);
  const auteurId = req.session.userId;

  if (isNaN(reviewId)) return res.status(400).json({ error: 'Ongeldig id' });

  try {
    const review = await prisma.review.findUnique({ where: { Review_id: reviewId } });

    if (!review) return res.status(404).json({ error: 'Review niet gevonden' });
    if (review.Auteur_id !== auteurId) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    await prisma.review.delete({ where: { Review_id: reviewId } });

    res.json({ message: 'Review verwijderd' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij verwijderen review' });
  }
});

export default router;
