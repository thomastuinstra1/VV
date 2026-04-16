// ── GET /uitleen/:id ──
export const toUitleenResponseDTO = (u) => ({
  Uitleen_id: u.Uitleen_id,
  Account_id: u.Account_id ?? null,
  Gereedschap_id: u.Gereedschap_id ?? null,
  StartDatum: u.StartDatum ?? null,
  EindDatum: u.EindDatum ?? null,
  BorgBedrag: u.BorgBedrag ?? null,
  Status: u.Status ?? null,
  Lener_id: u.Lener_id ?? null,
  StartTijd: u.StartTijd ?? null,
  EindTijd: u.EindTijd ?? null,
  Adres: u.Adres ?? null
});

// ── PATCH status ──
export const toUitleenStatusUpdateDTO = (status) => ({
  status
});

// ── dashboard uitleningen ──
export const toDashboardUitleningDTO = (u) => ({
  Uitleen_id: u.Uitleen_id,
  Status: u.Status,
  StartDatum: u.StartDatum,
  EindDatum: u.EindDatum,
  BorgBedrag: u.BorgBedrag,
  Account_id: u.Account_id,
  Gereedschap_id: u.Gereedschap_id,
  lenerNaam: u.lenerNaam ?? null,
  lenerEmail: u.lenerEmail ?? null,
  gereedschapNaam: u.gereedschapNaam ?? null
});

// ── dashboard gereedschap ──
export const toDashboardGereedschapDTO = (g) => ({
  Gereedschap_id: g.Gereedschap_id,
  Naam: g.Naam,
  Beschrijving: g.Beschrijving,
  BorgBedrag: g.BorgBedrag,
  Afbeelding: g.Afbeelding,
  status: g.status,
  activeUitleenId: g.activeUitleenId ?? null,
  lenerNaam: g.lenerNaam ?? null,
  lenerEmail: g.lenerEmail ?? null,
  eindDatum: g.eindDatum ?? null
});

// ── mijn leningen ──
export const toMijnLeningDTO = (u) => ({
  Uitleen_id: u.Uitleen_id,
  Status: u.Status,
  StartDatum: u.StartDatum,
  EindDatum: u.EindDatum,
  BorgBedrag: u.BorgBedrag,
  Gereedschap_id: u.Gereedschap_id,
  gereedschapNaam: u.gereedschapNaam ?? null,
  Afbeelding: u.Afbeelding ?? null,
  eigenaarId: u.eigenaarId ?? null,
  eigenaarNaam: u.eigenaarNaam ?? null,
  eigenaarEmail: u.eigenaarEmail ?? null,
  Chat_id: u.Chat_id ?? null
});

// ── create ──
export const toUitleenCreateResponseDTO = (u) => ({
  message: 'Uitleen aangemaakt!',
  id: u.Uitleen_id
});