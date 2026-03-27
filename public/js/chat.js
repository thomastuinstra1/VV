let CURRENT_USER_ID;
let CHAT_ID;          // Nieuw: chatId ipv alleen partnerId
let CHAT_PARTNER_ID;
let TOOL_ID;          // Gereedschap dat bij deze chat hoort
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

// Chat en tool ophalen uit URL: ?chat=12
function getChatInfo() {
  const params = new URLSearchParams(window.location.search);
  CHAT_ID = parseInt(params.get('chat'));
  if (!CHAT_ID) return console.error('Geen chat ID opgegeven in URL (bijv. ?chat=12)');
}

// Voeg bericht toe aan UI
async function addMessageToUI(message) {
  const box = document.getElementById("chat-box");
  const div = document.createElement("div");
  const isMe = message.senderId === CURRENT_USER_ID;
  div.className = isMe ? 'my-message' : 'their-message';

  // 🔹 Normaal bericht
  if (!message.type || message.type === "text") {
    div.textContent = `${isMe ? 'Jij' : 'Partner'}: ${message.content}`;
  }

  // 🔹 Afspraak bericht
  if (message.type === "appointment") {
    const res = await fetch(`/uitleen/${message.uitleenId}`);
    const uitleen = await res.json();

    div.innerHTML = `
      <div style="border:1px solid #ccc; padding:10px; border-radius:10px;">
        <p><b>📅 Afspraak</b></p>
        <p>Borg: €${uitleen.BorgBedrag}</p>
        <p>Van: ${uitleen.StartDatum.split('T')[0]}</p>
        <p>Tot: ${uitleen.EindDatum.split('T')[0]}</p>

        ${
          uitleen.Status === "pending" && !isMe
            ? `
              <button onclick="respond(${uitleen.Uitleen_id}, 'accept')">Accepteren</button>
              <button onclick="respond(${uitleen.Uitleen_id}, 'reject')">Weigeren</button>
            `
            : `<p>Status: ${uitleen.Status}</p>`
        }
      </div>
    `;
  }

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Verstuur bericht via Socket.IO
function sendMessage(content) {
  if (!socket || !CHAT_ID || !content) return;
  socket.emit("send_message", { chatId: CHAT_ID, content });
}

// Oude berichten ophalen
async function loadMessages() {
  try {
    const res = await fetch(`/messages/chat/${CHAT_ID}`);
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

  // Nieuwe berichten ontvangen
  socket.on("receive_message", (message) => {
    if (message.Chat_id === CHAT_ID) addMessageToUI(message);
  });

  // Afspraak geüpdatet
  socket.on("appointment_created", (uitleen) => {
    addMessageToUI({ type: "appointment", uitleenId: uitleen.Uitleen_id, senderId: uitleen.LenerId });
  });

  socket.on("disconnect", () => console.log("Socket.IO verbinding verbroken"));
}

// DOMContentLoaded – alles initialiseren
document.addEventListener("DOMContentLoaded", async () => {
  await getCurrentUserId();
  getChatInfo();
  if (!CURRENT_USER_ID || !CHAT_ID) return;

  initSocket();
  await loadMessages();

  // Versturen via button
  const sendBtn = document.getElementById("send-btn");
  const input = document.getElementById("chat-input");
  sendBtn.addEventListener("click", () => {
    const content = input.value.trim();
    if (!content) return;
    sendMessage(content);
    input.value = '';
  });

  // Versturen met Enter
  input.addEventListener("keydown", (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const content = input.value.trim();
      if (!content) return;
      sendMessage(content);
      input.value = '';
    }
  });
});

// Afspraak accept/ reject
window.respond = function(uitleenId, action) {
  socket.emit("respond_appointment", { uitleenId, action });
};

// Modal popup open/close
window.openModal = function() {
  document.getElementById("modal").style.display = "block";
};
window.closeModal = function() {
  document.getElementById("modal").style.display = "none";
};

// Verstuur afspraak via Socket.IO
window.sendAppointment = function() {
  const borg = document.getElementById("borg").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  if (!CHAT_ID) return alert("Geen chat geselecteerd");

  socket.emit("send_appointment", {
    chatId: CHAT_ID,
    borg,
    startDate,
    endDate
  });

  closeModal();
};

console.log('CURRENT_USER_ID:', CURRENT_USER_ID);
console.log('CHAT_ID:', CHAT_ID);