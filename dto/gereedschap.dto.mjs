
// ── CREATE ──
export const toGereedschapCreateDTO = (body) => ({
  name: body.Naam,
  description: body.Beschrijving,
  startDate: body.Begindatum,
  endDate: body.Einddatum,
  deposit: body.BorgBedrag,
  image: body.Afbeelding,
  categories: body.categorieen ?? []
});

export const toGereedschapCreateResponseDTO = (tool) => ({
  message: 'Gereedschap opgeslagen!',
  id: tool.Gereedschap_id
});


// ── LIST ──
export const toGereedschapResponseDTO = (tools) => {
  return tools.map(t => ({
    Gereedschap_id: t.Gereedschap_id,
    Naam: t.Naam,
    Beschrijving: t.Beschrijving,
    BorgBedrag: t.BorgBedrag,
    Afbeelding: t.Afbeelding,
    Begindatum: t.Begindatum,
    Einddatum: t.Einddatum,
    Account_id: t.Account_id,
    Account: t.Account ?? null
  }));
};


// ── CATEGORIEEN ──
export const toCategorieResponseDTO = (categorieen) => categorieen;

export const toGereedschapCategorieDTO = (koppelingen) => koppelingen;


// ── UPDATE ──
export const toGereedschapUpdateDTO = (body) => ({
  name: body.Naam,
  description: body.Beschrijving,
  deposit: body.BorgBedrag,
  startDate: body.Begindatum,
  endDate: body.Einddatum,
  categories: body.categorieen
});
