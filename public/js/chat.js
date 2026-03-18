let CURRENT_USER_ID;
let CHAT_PARTNER_ID;
let socket;

// Huidige gebruiker ophalen vanuit backend
async function getCurrentUserId() {
  try {
    const res = await fetch('/me');
    if (!res.ok) throw new Error('Kon gebruiker niet ophalen');
    const user = await res.json();
    CURRENT_USER_ID = user.Account_id;
  } catch (err) {
    console.error(err);
  }
}

// CHAT_PARTNER_ID ophalen uit URL
function getChatPartnerId() {
  const params = new URLSearchParams(window.location.search);
  CHAT_PARTNER_ID = parseInt(params.get('partner'));
  if (!CHAT_PARTNER_ID) console.error('Geen partner ID opgegeven in URL (bijv. ?partner=2)');
}

// Voeg bericht toe aan UI
function addMessageToUI(message) {
  const box = document.getElementById("chat-box");
  const div = document.createElement("div");
  div.textContent = `${message.senderId === CURRENT_USER_ID ? 'Jij' : 'Partner'}: ${message.content}`;
  div.className = message.senderId === CURRENT_USER_ID ? 'my-message' : 'their-message';
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Verstuur bericht via Socket.IO
function sendMessage(toUserId, content) {
  if (!socket || !toUserId || !content) return;
  socket.emit("send_message", { content, toUserId });
}

// Oude berichten ophalen
async function loadMessages() {
  try {
    const res = await fetch(`/messages/${CHAT_PARTNER_ID}`);
    if (!res.ok) throw new Error('Kon berichten niet ophalen');
    const messages = await res.json();
    messages.forEach(msg => addMessageToUI(msg));
  } catch (err) {
    console.error(err);
  }
}

// Socket.IO initialiseren
function initSocket() {
  socket = io("https://gereedschapspunt.student.open-ict.hu", {
    auth: { userId: CURRENT_USER_ID }
  });

  socket.on("connect", () => {
    console.log(`Verbonden met Socket.IO als user ${CURRENT_USER_ID}`);
  });

  socket.on("receive_message", (message) => {
    // Alleen berichten van/naar huidige partner tonen
    if (message.senderId === CHAT_PARTNER_ID || message.receiverId === CHAT_PARTNER_ID) {
      addMessageToUI(message);
    }
  });

  socket.on("disconnect", () => console.log("Socket.IO verbinding verbroken"));
}

// DOMContentLoaded – alles initialiseren
document.addEventListener("DOMContentLoaded", async () => {
  await getCurrentUserId();
  getChatPartnerId();

  if (!CURRENT_USER_ID || !CHAT_PARTNER_ID) return;

  initSocket();
  await loadMessages();

  // Versturen via button
  const sendBtn = document.getElementById("send-btn");
  const input = document.getElementById("chat-input");

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