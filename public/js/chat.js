let CURRENT_USER_ID;
let CHAT_PARTNER_ID;

//Haal CURRENT_USER_ID op vanuit de backend
async function getCurrentUserId() {
  try {
    const res = await fetch('/me');
    if (!res.ok) throw new Error('Kon gebruiker niet ophalen');
    const user = await res.json();
    CURRENT_USER_ID = user.Account_id; // pas aan als jouw backend een andere property gebruikt
  } catch (err) {
    console.error('Fout bij ophalen huidige gebruiker:', err);
  }
}

//Haal CHAT_PARTNER_ID op uit URL query parameter
function getChatPartnerId() {
  const urlParams = new URLSearchParams(window.location.search);
  const partnerId = parseInt(urlParams.get('partner'));
  if (!partnerId) {
    console.error('Geen partner ID opgegeven in URL (bijv. ?partner=2)');
  }
  CHAT_PARTNER_ID = partnerId;
}

//Voeg bericht toe aan UI
function addMessageToUI(message) {
  const box = document.getElementById("chat-box");
  const div = document.createElement("div");
  div.textContent = `${message.senderId === CURRENT_USER_ID ? 'Jij' : 'Partner'}: ${message.content}`;
  div.className = message.senderId === CURRENT_USER_ID ? 'my-message' : 'their-message';
  box.appendChild(div);
  box.scrollTop = box.scrollHeight; // scroll automatisch naar beneden
}

//Bericht verzenden
function sendMessage(toUserId, content) {
  socket.emit("send_message", { content, toUserId });
}

//Huidige chat ophalen
async function loadMessages(otherUserId) {
  try {
    const res = await fetch(`/messages/${otherUserId}`);
    if (!res.ok) throw new Error('Kon berichten niet ophalen');
    const messages = await res.json();
    messages.forEach(msg => addMessageToUI(msg));
  } catch (err) {
    console.error('Fout bij laden berichten:', err);
  }
}

//Socket.IO connectie opzetten (pas URL aan naar je frontend/server)
let socket;
async function initSocket() {
  socket = io("https://gereedschapspunt.student.open-ict.hu", {
    auth: { userId: CURRENT_USER_ID }
  });

  socket.on("connect", () => {
    console.log(`Verbonden met Socket.IO als user ${CURRENT_USER_ID}`);
  });

  socket.on("receive_message", (message) => {
    addMessageToUI(message);
  });

  socket.on("disconnect", () => {
    console.log("Socket.IO verbinding verbroken");
  });
}

//Alles initialiseren bij laden pagina
document.addEventListener("DOMContentLoaded", async () => {
  await getCurrentUserId();
  getChatPartnerId();

  if (!CURRENT_USER_ID || !CHAT_PARTNER_ID) return;

  await initSocket();
  await loadMessages(CHAT_PARTNER_ID);

  // Verstuur bericht via input/button
  const sendBtn = document.querySelector("#send-btn");
  const input = document.querySelector("#chat-input");
  sendBtn.addEventListener("click", () => {
    const content = input.value.trim();
    if (!content) return;
    sendMessage(CHAT_PARTNER_ID, content);
    input.value = '';
  });

  // Versturen met Enter
  input.addEventListener("keydown", (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const content = input.value.trim();
      if (!content) return;
      sendMessage(CHAT_PARTNER_ID, content);
      input.value = '';
    }
  });
});