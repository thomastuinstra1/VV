
// ── FORGOT PASSWORD ──
export const toForgotPasswordDTO = (body) => ({
  email: body.email
});

// ── RESET PASSWORD ──
export const toResetPasswordDTO = (body) => ({
  token: body.token,
  password: body.password
});