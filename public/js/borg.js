const params    = new URLSearchParams(window.location.search);
const uitleenId = params.get('uitleenId');

document.getElementById('uitleen-id').textContent = uitleenId;

// ── Uitleen info ophalen ──────────────────────────────────────────────────
const uitleen = await fetchWithSpinner(`/uitleen/${uitleenId}`).then(r => r.json());
document.getElementById('borg-bedrag').textContent = Number(uitleen.BorgBedrag).toFixed(2);

// ── Stripe initialiseren ──────────────────────────────────────────────────
// Vervang met jouw eigen publishable key
const stripe = Stripe('pk_test_51TN7PmALXfqYZDCcGin5pu1vTCWMiqPW32Ci3Dm9aOrmkyAiMQ8cMsv2cfu9bAVGpXyTpDxHWbX6HJV9UfiFdQpW00m7DaQOkZ');

let elementsInstantie = null; // wordt aangemaakt nadat methode gekozen is

// ── Stap 1: gebruiker kiest betaalmethode ────────────────────────────────
window.kiesMethode = async function(methode) {
  // Knoppen uitschakelen tijdens laden
  document.getElementById('kies-card').disabled  = true;
  document.getElementById('kies-ideal').disabled = true;

  try {
    // PaymentIntent aanmaken met de gekozen methode
    const res = await fetchWithSpinner(`/uitleen/${uitleenId}/borg/betalen`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ methode })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Aanmaken betaling mislukt');
    }

    const { clientSecret } = await res.json();

    // Stripe Elements aanmaken voor de gekozen methode
    elementsInstantie = stripe.elements({
      clientSecret,
      appearance: { theme: 'stripe' }
    });

    // Payment Element toont automatisch de juiste invoervelden
    // voor de gekozen methode (card of iDEAL)
    const paymentElement = elementsInstantie.create('payment');
    paymentElement.mount('#payment-element');

    // Schakel over naar het betaalformulier
    document.getElementById('methode-keuze').style.display  = 'none';
    document.getElementById('betaal-sectie').style.display  = 'block';

  } catch (err) {
    document.getElementById('kies-card').disabled  = false;
    document.getElementById('kies-ideal').disabled = false;
    alert('Fout: ' + err.message);
  }
};

// ── Terug naar methode-keuze ─────────────────────────────────────────────
window.resetMethode = function() {
  elementsInstantie = null;
  document.getElementById('payment-element').innerHTML = '';
  document.getElementById('card-error').textContent    = '';
  document.getElementById('methode-keuze').style.display  = 'block';
  document.getElementById('betaal-sectie').style.display  = 'none';
  document.getElementById('kies-card').disabled  = false;
  document.getElementById('kies-ideal').disabled = false;
};

// ── Stap 2: betalen ───────────────────────────────────────────────────────
document.getElementById('betaal-btn').addEventListener('click', async () => {
  if (!elementsInstantie) return;

  const btn     = document.getElementById('betaal-btn');
  const errorEl = document.getElementById('card-error');

  btn.disabled    = true;
  btn.textContent = 'Bezig...';
  errorEl.textContent = '';

  // confirmPayment werkt voor zowel card als iDEAL:
  //   • card:  geen redirect nodig, resultaat direct beschikbaar
  //   • iDEAL: redirect naar bank, gebruiker komt terug op return_url
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements: elementsInstantie,
    redirect: 'if_required', // voorkomt onnodige redirect bij card
    confirmParams: {
      return_url: `${window.location.origin}/borg-bevestiging.html?uitleenId=${uitleenId}`
    }
  });

  if (error) {
    errorEl.textContent = error.message;
    btn.disabled    = false;
    btn.textContent = 'Borg betalen';
    return;
  }

  // Geen redirect (card) → status direct verwerken
  if (paymentIntent?.status === 'requires_capture') {
    // card: borg gereserveerd, wacht op incasso of annulering door uitlener
    document.getElementById('status-bericht').textContent =
      '✅ Borg succesvol gereserveerd! Je wordt teruggestuurd naar de chat.';
    setTimeout(() => history.back(), 3000);

  } else if (paymentIntent?.status === 'succeeded') {
    // iDEAL zonder redirect (zeldzaam): borg direct afgeschreven
    document.getElementById('status-bericht').textContent =
      '✅ Borgbetaling gelukt! Je wordt teruggestuurd naar de chat.';
    setTimeout(() => history.back(), 3000);
  }
});
