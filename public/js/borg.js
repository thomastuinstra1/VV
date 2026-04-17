const params = new URLSearchParams(window.location.search);
const uitleenId = params.get('uitleenId');

document.getElementById('uitleen-id').textContent = uitleenId;

// Uitleen info ophalen
const uitleen = await fetchWithSpinner(`/uitleen/${uitleenId}`).then(r => r.json());
document.getElementById('borg-bedrag').textContent = uitleen.BorgBedrag;

// PaymentIntent aanmaken
const { clientSecret } = await fetchWithSpinner(`/uitleen/${uitleenId}/borg/betalen`, {
  method: 'POST'
}).then(r => r.json());

// Stripe initialiseren
const stripe = Stripe('pk_test_51TN7PmALXfqYZDCcGin5pu1vTCWMiqPW32Ci3Dm9aOrmkyAiMQ8cMsv2cfu9bAVGpXyTpDxHWbX6HJV9UfiFdQpW00m7DaQOkZ'); // vervang met je eigen sleutel
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

document.getElementById('betaal-sectie').style.display = 'block';

document.getElementById('betaal-btn').addEventListener('click', async () => {
  const btn = document.getElementById('betaal-btn');
  btn.disabled = true;
  btn.textContent = 'Bezig...';

  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: cardElement }
  });

  if (error) {
    document.getElementById('card-error').textContent = error.message;
    btn.disabled = false;
    btn.textContent = 'Borg betalen';
  } else if (paymentIntent.status === 'requires_capture') {
    document.getElementById('status-bericht').textContent =
      '✅ Borg succesvol gereserveerd! Je wordt teruggestuurd naar de chat.';
    setTimeout(() => history.back(), 3000);
  }
});