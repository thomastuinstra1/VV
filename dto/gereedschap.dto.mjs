// ── CREATE ──
export const toGereedschapCreateDTO = (body) => ({
  name:       body.Naam,
  description: body.Beschrijving,
  startDate:  body.Begindatum,
  endDate:    body.Einddatum,
  deposit:    body.BorgBedrag,
  image:      body.Afbeelding,
  categories: body.categorieen ?? []
});

export const toGereedschapCreateResponseDTO = (tool) => ({
  message: 'Gereedschap opgeslagen!',
  id:      tool.Gereedschap_id
});


// ── LIST ──
export const toGereedschapResponseDTO = (tools) => {
  return tools.map(t => {

    // Groepeer categorieën op parent naam
    const specs = {};
    for (const koppeling of t.Gereedschap_Categorie ?? []) {
      const kind   = koppeling.Categorie;
      const parent = kind?.Categorie;         // de parent via Parent_id
      if (parent?.Naam && kind?.Naam) {
        if (!specs[parent.Naam]) specs[parent.Naam] = [];
        specs[parent.Naam].push(kind.Naam);
      }
    }

    return {
      Gereedschap_id: t.Gereedschap_id,
      Naam:           t.Naam,
      Beschrijving:   t.Beschrijving,
      BorgBedrag:     t.BorgBedrag,
      Afbeelding:     t.Afbeelding,
      Begindatum:     t.Begindatum,
      Einddatum:      t.Einddatum,
      Account_id:     t.Account_id,

      // bijv. { Type: ["Tuingereedschap"], Werkwijze: ["Accu"], Materiaal: ["Hout", "Steen"] }
      specs,

      eigenaar: t.Account ? {
        Account_id:      t.Account.Account_id,
        Name:            t.Account.Name,
        Afbeelding:      t.Account.Afbeelding,
        aantalRapporten: t.Account.Report_Report_Gemelde_idToAccount?.length ?? 0,
        lat:             t.Account.lat,
        lon:             t.Account.lon
      } : null
    };
  });
};


// ── CATEGORIEËN VAN GEREEDSCHAP ──
export const toGereedschapCategorieDTO = (koppelingen) => {
  return koppelingen.map(k => ({
    Gereedschap_id: k.Gereedschap_id,
    Categorie_id:   k.Categorie_id
  }));
};


// ── UPDATE ──
export const toGereedschapUpdateDTO = (body) => ({
  name:        body.Naam,
  description: body.Beschrijving,
  deposit:     body.BorgBedrag,
  startDate:   body.Begindatum,
  endDate:     body.Einddatum,
  categories:  body.categorieen
});
