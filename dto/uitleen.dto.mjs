// ── GET /uitleen/:id ──
export const toUitleenResponseDTO = (u) => ({
  Uitleen_id:     u.Uitleen_id,
  Account_id:     u.Account_id     ?? null,
  Gereedschap_id: u.Gereedschap_id ?? null,
  StartDatum:     u.StartDatum     ?? null,
  EindDatum:      u.EindDatum      ?? null,
  BorgBedrag:     u.BorgBedrag     ?? null,
  Status:         u.Status         ?? null,
  Lener_id:       u.Lener_id       ?? null,
  StartTijd:      u.StartTijd      ?? null,
  EindTijd:       u.EindTijd       ?? null,
  Adres:          u.Adres          ?? null
});


// ── PATCH /uitleen/:id/status ──
export const toStatusUpdateResponseDTO = (status) => ({
  message: 'Status bijgewerkt',
  status
});


// ── GET /dashboard/uitleningen ──
// Mapping zit in de DTO: lenerMap wordt meegegeven als parameter
export const toDashboardUitleningDTO = (u, lenerMap) => ({
  Uitleen_id:      u.Uitleen_id,
  Status:          u.Status,
  StartDatum:      u.StartDatum,
  EindDatum:       u.EindDatum,
  BorgBedrag:      u.BorgBedrag,
  Account_id:      u.Account_id,
  Gereedschap_id:  u.Gereedschap_id,
  lenerNaam:       lenerMap[u.Lener_id]?.Name   ?? null,
  lenerEmail:      lenerMap[u.Lener_id]?.E_mail ?? null,
  gereedschapNaam: u.Gereedschap?.Naam           ?? null
});


// ── GET /dashboard/gereedschap ──
// Statusberekening zit in de route (heeft `now` nodig), DTO filtert de output
export const toDashboardGereedschapDTO = (g) => ({
  Gereedschap_id:  g.Gereedschap_id,
  Naam:            g.Naam,
  Beschrijving:    g.Beschrijving,
  BorgBedrag:      g.BorgBedrag,
  Afbeelding:      g.Afbeelding,
  status:          g.status,
  activeUitleenId: g.activeUitleenId ?? null,
  lenerNaam:       g.lenerNaam       ?? null,
  lenerEmail:      g.lenerEmail      ?? null,
  eindDatum:       g.eindDatum       ?? null
});


// ── GET /mijn-leningen ──
// Chat-koppeling en eigenaar-info worden in de route opgehaald en hier gefilterd
export const toMijnLeningDTO = (u, chatList, lenerId) => {
  const tool     = u.Gereedschap ?? null;
  const eigenaar = tool?.Account ?? null;

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
    gereedschapNaam: tool?.Naam       ?? null,
    Afbeelding:      tool?.Afbeelding ?? null,
    eigenaarId:      eigenaar?.Account_id ?? null,
    eigenaarNaam:    eigenaar?.Name   ?? null,
    eigenaarEmail:   eigenaar?.E_mail ?? null,
    Chat_id:         chat?.Chat_id    ?? null
  };
};


// ── POST /uitleen ──
export const toUitleenCreateResponseDTO = (u) => ({
  message: 'Uitleen aangemaakt!',
  id:      u.Uitleen_id
});
