const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

export async function sendEmail(type, userEmail, userName, toolName = null) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, userEmail, userName, toolName })
    });
  } catch (err) {
    console.error('E-mail versturen mislukt:', err);
  }
}