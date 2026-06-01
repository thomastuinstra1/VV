import { Router } from 'express';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';

const router = Router();

const AFGEROND = ['ingeleverd_op_tijd', 'ingeleverd_te_laat'];

// ─── Helper: rapportage-aantallen per review ophalen ─────────────────────────
async function getReportCounts(reviewIds, reviewType) {
  if (!reviewIds.length) return {};
  const reports = await prisma.review_Report.groupBy({
    by:    ['review_id'],
    where: { review_id: { in: reviewIds }, review_type: reviewType },
    _count: { review_id: true },
  });
  return Object.fromEntries(reports.map((r) => [r.review_id, r._count.review_id]));
}

// ─── Helper: Set van account-ids waarmee melder een uitleen heeft gehad ───────
// Eén query, in-memory matchen — voorkomt N queries per review
async function getAccountInteractieSet(melderId) {
  if (!melderId) return new Set();
  const uitlenen = await prisma.uitleen.findMany({
    where: {
      OR: [
        { Lener_id:   melderId },
        { Account_id: melderId },
      ],
    },
    select: { Lener_id: true, Account_id: true },
  });
  const ids = new Set();
  for (const u of uitlenen) {
    if (u.Lener_id   !== melderId) ids.add(u.Lener_id);
    if (u.Account_id !== melderId) ids.add(u.Account_id);
  }
  return ids;
}

// ─── Helper: Set van gereedschap-ids die de melder ooit heeft geleend ─────────
async function getGereedschapInteractieSet(melderId) {
  if (!melderId) return new Set();
  const uitlenen = await prisma.uitleen.findMany({
    where:  { Lener_id: melderId },
    select: { Gereedschap_id: true },
  });
  return new Set(uitlenen.map((u) => u.Gereedschap_id));
}

// ─── GET /account/:id/reviews  (reviews ontvangen als verhuurder) ─────────────
router.get('/account/:id/reviews', async (req, res) => {
  const ontvangerID = parseInt(req.params.id);
  if (isNaN(ontvangerID)) return res.status(400).json({ error: 'Ongeldig id' });

  const mijnId = req.session?.userId ?? null;

  try {
    const reviews = await prisma.review.findMany({
      where: { Ontvanger_id: ontvangerID },
      include: {
        Account_Review_Auteur_idToAccount: {
          select: { Account_id: true, Name: true, Afbeelding: true },
        },
        Uitleen: { select: { Account_id: true, Lener_id: true } },
      },
      orderBy: { Datum: 'desc' },
    });

    const verhuurderReviews = reviews.filter(
      (r) => r.Uitleen?.Account_id === ontvangerID
    );

    const reportCounts   = await getReportCounts(verhuurderReviews.map((r) => r.Review_id), 'account');
    const interactieSet  = await getAccountInteractieSet(mijnId);

    res.json(verhuurderReviews.map((r) => ({
      Review_id:         r.Review_id,
      Uitleen_id:        r.Uitleen_id,
      Auteur_id:         r.Auteur_id,
      auteurNaam:        r.Account_Review_Auteur_idToAccount?.Name ?? 'Onbekend',
      auteurAfbeelding:  r.Account_Review_Auteur_idToAccount?.Afbeelding ?? null,
      Tekst:             r.Tekst,
      Rating:            r.Rating,
      Datum:             r.Datum,
      aantalRapportages: reportCounts[r.Review_id] ?? 0,
      // Knop tonen als: ingelogd + niet eigen review + uitleen gehad met auteur
      kanRapporteren:    !!mijnId && mijnId !== r.Auteur_id && interactieSet.has(r.Auteur_id),
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

  const mijnId = req.session?.userId ?? null;

  try {
    const reviews = await prisma.review.findMany({
      where: { Ontvanger_id: ontvangerID },
      include: {
        Account_Review_Auteur_idToAccount: {
          select: { Account_id: true, Name: true, Afbeelding: true },
        },
        Uitleen: { select: { Account_id: true, Lener_id: true } },
      },
      orderBy: { Datum: 'desc' },
    });

    const lenerReviews  = reviews.filter((r) => r.Uitleen?.Lener_id === ontvangerID);
    const reportCounts  = await getReportCounts(lenerReviews.map((r) => r.Review_id), 'account');
    const interactieSet = await getAccountInteractieSet(mijnId);

    res.json(lenerReviews.map((r) => ({
      Review_id:         r.Review_id,
      Uitleen_id:        r.Uitleen_id,
      Auteur_id:         r.Auteur_id,
      auteurNaam:        r.Account_Review_Auteur_idToAccount?.Name ?? 'Onbekend',
      auteurAfbeelding:  r.Account_Review_Auteur_idToAccount?.Afbeelding ?? null,
      Tekst:             r.Tekst,
      Rating:            r.Rating,
      Datum:             r.Datum,
      aantalRapportages: reportCounts[r.Review_id] ?? 0,
      kanRapporteren:    !!mijnId && mijnId !== r.Auteur_id && interactieSet.has(r.Auteur_id),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij ophalen lener-reviews' });
  }
});

// ─── GET /uitlenen/te-reviewen?verhuurder=<id> ────────────────────────────────
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
      orderBy:  { EindDatum: 'desc' },
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
      orderBy:  { EindDatum: 'desc' },
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
    if (review.Auteur_id !== auteurId) return res.status(403).json({ error: 'Geen toegang' });

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
    if (review.Auteur_id !== auteurId) return res.status(403).json({ error: 'Geen toegang' });

    await prisma.review.delete({ where: { Review_id: reviewId } });
    res.json({ message: 'Review verwijderd' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij verwijderen review' });
  }
});

// ─── POST /reviews/:id/report ─────────────────────────────────────────────────
router.post('/reviews/:id/report', isLoggedIn, async (req, res) => {
  const reviewId = parseInt(req.params.id);
  const melderId = req.session.userId;
  const { reden } = req.body;

  if (isNaN(reviewId)) return res.status(400).json({ error: 'Ongeldig id' });

  try {
    const review = await prisma.review.findUnique({ where: { Review_id: reviewId } });
    if (!review) return res.status(404).json({ error: 'Review niet gevonden' });
    if (review.Auteur_id === melderId) {
      return res.status(400).json({ error: 'Je kunt je eigen review niet rapporteren' });
    }

    // ── Interactie-check ──────────────────────────────────────────────────────
    const interactie = await prisma.uitleen.findFirst({
      where: {
        OR: [
          { Lener_id: melderId, Account_id: review.Auteur_id },
          { Lener_id: review.Auteur_id, Account_id: melderId },
        ],
      },
    });
    if (!interactie) {
      return res.status(403).json({
        error: 'Je kunt alleen reviews rapporteren van mensen waarmee je een uitleen hebt gehad',
      });
    }

    await prisma.review_Report.create({
      data: { review_id: reviewId, review_type: 'account', melder_id: melderId, reden: reden?.trim() || null },
    });

    res.status(201).json({ message: 'Review gerapporteerd' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Je hebt deze review al gerapporteerd' });
    console.error(err);
    res.status(500).json({ error: 'Fout bij rapporteren' });
  }
});

// ─── GET /gereedschap/:id/reviews ─────────────────────────────────────────────
router.get('/gereedschap/:id/reviews', async (req, res) => {
  const gereedschapId = parseInt(req.params.id);
  if (isNaN(gereedschapId)) return res.status(400).json({ error: 'Ongeldig id' });

  const mijnId = req.session?.userId ?? null;

  try {
    const reviews = await prisma.gereedschap_Review.findMany({
      where:   { Gereedschap_id: gereedschapId },
      include: { Account: { select: { Account_id: true, Name: true, Afbeelding: true } } },
      orderBy: { Datum: 'desc' },
    });

    const reportCounts          = await getReportCounts(reviews.map((r) => r.Review_id), 'gereedschap');
    const gereedschapInteractie = await getGereedschapInteractieSet(mijnId);

    const gemiddelde = reviews.length
      ? reviews.reduce((s, r) => s + r.Rating, 0) / reviews.length
      : null;

    res.json({
      gemiddelde: gemiddelde ? parseFloat(gemiddelde.toFixed(1)) : null,
      aantal:     reviews.length,
      reviews:    reviews.map((r) => ({
        Review_id:         r.Review_id,
        Uitleen_id:        r.Uitleen_id,
        Auteur_id:         r.Auteur_id,
        auteurNaam:        r.Account?.Name ?? 'Onbekend',
        auteurAfbeelding:  r.Account?.Afbeelding ?? null,
        Tekst:             r.Tekst,
        Rating:            r.Rating,
        Datum:             r.Datum,
        aantalRapportages: reportCounts[r.Review_id] ?? 0,
        // Knop tonen als: ingelogd + niet eigen review + dit gereedschap ooit geleend
        kanRapporteren:    !!mijnId && mijnId !== r.Auteur_id && gereedschapInteractie.has(gereedschapId),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij ophalen reviews' });
  }
});

// ─── GET /gereedschap/:id/uitleen-te-reviewen ─────────────────────────────────
router.get('/gereedschap/:id/uitleen-te-reviewen', isLoggedIn, async (req, res) => {
  const gereedschapId = parseInt(req.params.id);
  const lenerId       = req.session.userId;
  if (isNaN(gereedschapId)) return res.status(400).json({ error: 'Ongeldig id' });

  try {
    const uitlenen = await prisma.uitleen.findMany({
      where: {
        Gereedschap_id:     gereedschapId,
        Lener_id:           lenerId,
        Status:             { in: AFGEROND },
        Gereedschap_Review: { none: { Auteur_id: lenerId } },
      },
      orderBy: { EindDatum: 'desc' },
    });

    res.json(uitlenen.map((u) => ({ Uitleen_id: u.Uitleen_id, EindDatum: u.EindDatum })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij ophalen uitlenen' });
  }
});

// ─── POST /gereedschap/:id/reviews ────────────────────────────────────────────
router.post('/gereedschap/:id/reviews', isLoggedIn, async (req, res) => {
  const gereedschapId = parseInt(req.params.id);
  const auteurId      = req.session.userId;
  const { Uitleen_id, Tekst, Rating } = req.body;

  if (!Uitleen_id || !Rating) {
    return res.status(400).json({ error: 'Uitleen_id en Rating zijn verplicht' });
  }
  if (Rating < 1 || Rating > 5) {
    return res.status(400).json({ error: 'Rating moet tussen 1 en 5 zijn' });
  }

  try {
    const uitleen = await prisma.uitleen.findUnique({ where: { Uitleen_id: parseInt(Uitleen_id) } });

    if (!uitleen) return res.status(404).json({ error: 'Uitleen niet gevonden' });
    if (uitleen.Lener_id !== auteurId) {
      return res.status(403).json({ error: 'Alleen de lener kan dit gereedschap reviewen' });
    }
    if (!AFGEROND.includes(uitleen.Status)) {
      return res.status(400).json({ error: 'Uitleen moet afgerond zijn om te reviewen' });
    }
    if (uitleen.Gereedschap_id !== gereedschapId) {
      return res.status(400).json({ error: 'Uitleen hoort niet bij dit gereedschap' });
    }

    const bestaand = await prisma.gereedschap_Review.findFirst({
      where: { Uitleen_id: parseInt(Uitleen_id), Auteur_id: auteurId },
    });
    if (bestaand) {
      return res.status(409).json({ error: 'Je hebt dit gereedschap al beoordeeld voor deze uitleen' });
    }

    const review = await prisma.gereedschap_Review.create({
      data: {
        Gereedschap_id: gereedschapId,
        Auteur_id:      auteurId,
        Uitleen_id:     parseInt(Uitleen_id),
        Tekst:          Tekst?.trim() || null,
        Rating:         parseInt(Rating),
      },
    });

    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij aanmaken review' });
  }
});

// ─── PUT /gereedschap/reviews/:id ─────────────────────────────────────────────
router.put('/gereedschap/reviews/:id', isLoggedIn, async (req, res) => {
  const reviewId = parseInt(req.params.id);
  const auteurId = req.session.userId;
  const { Tekst, Rating } = req.body;

  if (isNaN(reviewId)) return res.status(400).json({ error: 'Ongeldig id' });
  if (Rating && (Rating < 1 || Rating > 5)) {
    return res.status(400).json({ error: 'Rating moet tussen 1 en 5 zijn' });
  }

  try {
    const review = await prisma.gereedschap_Review.findUnique({ where: { Review_id: reviewId } });
    if (!review) return res.status(404).json({ error: 'Review niet gevonden' });
    if (review.Auteur_id !== auteurId) return res.status(403).json({ error: 'Geen toegang' });

    const updated = await prisma.gereedschap_Review.update({
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

// ─── DELETE /gereedschap/reviews/:id ──────────────────────────────────────────
router.delete('/gereedschap/reviews/:id', isLoggedIn, async (req, res) => {
  const reviewId = parseInt(req.params.id);
  const auteurId = req.session.userId;

  if (isNaN(reviewId)) return res.status(400).json({ error: 'Ongeldig id' });

  try {
    const review = await prisma.gereedschap_Review.findUnique({ where: { Review_id: reviewId } });
    if (!review) return res.status(404).json({ error: 'Review niet gevonden' });
    if (review.Auteur_id !== auteurId) return res.status(403).json({ error: 'Geen toegang' });

    await prisma.gereedschap_Review.delete({ where: { Review_id: reviewId } });
    res.json({ message: 'Review verwijderd' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fout bij verwijderen review' });
  }
});

// ─── POST /gereedschap/reviews/:id/report ────────────────────────────────────
router.post('/gereedschap/reviews/:id/report', isLoggedIn, async (req, res) => {
  const reviewId = parseInt(req.params.id);
  const melderId = req.session.userId;
  const { reden } = req.body;

  if (isNaN(reviewId)) return res.status(400).json({ error: 'Ongeldig id' });

  try {
    const review = await prisma.gereedschap_Review.findUnique({ where: { Review_id: reviewId } });
    if (!review) return res.status(404).json({ error: 'Review niet gevonden' });
    if (review.Auteur_id === melderId) {
      return res.status(400).json({ error: 'Je kunt je eigen review niet rapporteren' });
    }

    // ── Interactie-check ──────────────────────────────────────────────────────
    const interactie = await prisma.uitleen.findFirst({
      where: {
        Lener_id:       melderId,
        Gereedschap_id: review.Gereedschap_id,
      },
    });
    if (!interactie) {
      return res.status(403).json({
        error: 'Je kunt alleen reviews rapporteren van gereedschap dat je zelf hebt geleend',
      });
    }

    await prisma.review_Report.create({
      data: { review_id: reviewId, review_type: 'gereedschap', melder_id: melderId, reden: reden?.trim() || null },
    });

    res.status(201).json({ message: 'Review gerapporteerd' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Je hebt deze review al gerapporteerd' });
    console.error(err);
    res.status(500).json({ error: 'Fout bij rapporteren' });
  }
});

export default router;
