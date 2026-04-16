// ── AUTH STATUS ──
export const toAuthStatusResponseDTO = (isLoggedIn) => ({
  ingelogd: isLoggedIn
});


// ── REGISTER ──
export const toRegisterDTO = (body) => ({
  name: body.Name,
  email: body.E_mail,
  password: body.Password,
  postcode: body.Postcode
});

export const toRegisterResponseDTO = (account) => ({
  message: 'Account aangemaakt!',
  id: account.Account_id
});


// ── LOGIN ──
export const toLoginDTO = (body) => ({
  login: body.login,
  password: body.Password
});

export const toLoginResponseDTO = (account) => ({
  message: 'Ingelogd!',
  Name: account.Name
});

// ── ME ──
export const toMeResponseDTO = (account) => ({
  Account_id: account.Account_id,
  Name: account.Name,
  E_mail: account.E_mail,
  Postcode: account.Postcode,
  Afbeelding: account.Afbeelding,
  lat: account.lat,
  lon: account.lon
});