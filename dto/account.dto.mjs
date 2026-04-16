// ── UPDATE ACCOUNT ──
export const toUpdateAccountDTO = (body) => ({
  name: body.Name ?? null,
  email: body.E_mail ?? null,
  postcode: body.Postcode ?? null,
  password: body.Password ?? null,
});

export const toUpdateAccountResponseDTO = (account) => ({
  message: 'Gegevens bijgewerkt!',
  Name: account.Name
});


// ── RAPPORTEREN ──
export const toReportDTO = (body) => ({
  reden: body.Reden ?? null
});

// ── PROFIEL ──
export const toPubliekProfielResponseDTO = (account, aantalRapporten) => ({
  Account_id: account.Account_id,
  Name: account.Name,
  E_mail: account.E_mail,
  Postcode: account.Postcode,
  Afbeelding: account.Afbeelding,
  aantalRapporten
});
