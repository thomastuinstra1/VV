const params      = new URLSearchParams(window.location.search);
const uitleenId   = params.get('uitleenId');
const clientSecret = params.get('payment_intent_client_secret'); // door Stripe toegevoegd na redirect

const iconEl   = document.getElementById('bevestiging-icon');
const titelEl  = document.getElementById('bevestiging-titel');
const tekstEl  = document.getElementById('bevestiging-tekst');
const detailsEl = document.getElementById('borg-details');
const terugBtn = document.getElementById('terug-btn');

// Stripe initialiseren (alleen voor status ophalen na redirect)
const stripe = Stripe('pk_test_51TN7PmALXfqYZDCcGin5pu1vTCWMiqPW32Ci3Dm9aOrmkyAiMQ8cMsv2cfu9bAVGpXyTpDxHWbX6HJV9UfiFdQpW00m7DaQOkZ'); // zelfde key als in borg.js

async function controleerBetaling() {
  try {
    // Uitleen info ophalen voor bedrag en teruglink
    const uitleen = await fetchWithSpinner(`/uitleen/${uitleenId}`).then(r => r.json());
    document.getElementById('uitleen-id').textContent  = uitleenId;
    document.getElementById('borg-bedrag').textContent = Number(uitleen.BorgBedrag).toFixed(2);

    // Stripe PaymentIntent status ophalen via clientSecret uit de URL
    // (Stripe voegt payment_intent_client_secret automatisch toe aan de return_url)
    if (clientSecret) {
      const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);

      if (error) {
        toonFout('Er ging iets mis bij het ophalen van de betaalstatus.');
        return;
      }

      switch (paymentIntent.status) {
        case 'succeeded':
        case 'requires_capture':
          // succeeded      = iDEAL geslaagd (direct afgeschreven)
          // requires_capture = card geslaagd (gereserveerd, nog niet afgeschreven)
          toonSucces(uitleen);
          break;

        case 'processing':
          // Betaling nog in verwerking (kan bij sommige methoden)
          toonVerwerking();
          break;

        case 'payment_failed':
        case 'canceled':
          toonFout('De betaling is mislukt of geannuleerd. Probeer het opnieuw.');
          terugBtn.href    = `/borg.html?uitleenId=${uitleenId}`;
          terugBtn.textContent = '← Opnieuw proberen';
          terugBtn.style.display = 'inline-block';
          break;

        default:
          toonFout(`Onbekende betaalstatus: ${paymentIntent.status}`);
      }

    } else {
      // Geen clientSecret in URL — gebruiker is hier direct naartoe genavigeerd
      // (bijv. via history.back() na card-betaling). Toon gewoon een algemene bevestiging.
      toonSucces(uitleen);
    }

  } catch (err) {
    console.error(err);
    toonFout('Kon de betaalstatus niet ophalen. Controleer je leningen voor de status.');
  }
}

function toonSucces(uitleen) {
  iconEl.textContent  = '✅';
  titelEl.textContent = 'Borgbetaling geslaagd!';
  tekstEl.textContent =
    'Je borg is succesvol betaald. De uitlener kan nu bevestigen dat het gereedschap is opgehaald. ' +
    'Bij tijdige inlevering ontvang je je borg automatisch terug.';
  detailsEl.style.display = 'block';

  // Zoek de chat terug op basis van uitleen — simpelste aanpak: history.back()
  terugBtn.href         = 'javascript:history.back()';
  terugBtn.textContent  = '← Terug naar chat';
  terugBtn.style.display = 'inline-block';
}

function toonVerwerking() {
  iconEl.textContent  = '⏳';
  titelEl.textContent = 'Betaling wordt verwerkt';
  tekstEl.textContent =
    'Je betaling is ontvangen en wordt verwerkt. Dit kan enkele minuten duren. ' +
    'Je ontvangt een bevestiging zodra de betaling is afgerond.';
  terugBtn.href         = 'javascript:history.back()';
  terugBtn.textContent  = '← Terug naar chat';
  terugBtn.style.display = 'inline-block';
}

function toonFout(bericht) {
  iconEl.textContent  = '❌';
  titelEl.textContent = 'Betaling mislukt';
  tekstEl.textContent = bericht;
}

controleerBetaling();
