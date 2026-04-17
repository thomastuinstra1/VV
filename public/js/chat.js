let CURRENT_USER_ID;
let CHAT_ID;
let socket;
let TOOL_BORG = 0;
let IS_OWNER = false; // ← nieuw

async function getCurrentUserId() {
  try {
    const res = await fetchWithSpinner('/me');
    if (!res.ok) throw new Error('Kon gebruiker niet ophalen');
    const user = await res.json();
    CURRENT_USER_ID = user.Account_id;
  } catch (err) {
    console.error(err);
  }
}

async function getChatInfo() {
  const params = new URLSearchParams(window.location.search);
  const partnerId = parseInt(params.get('partner'));
  const toolId = parseInt(params.get('tool')) || null;

  if (!partnerId) return console.error('Geen partner ID in URL');

  try {
    const res = await fetchWithSpinner('/chat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerId, toolId })
    });
    const chat = await res.json();
    CHAT_ID = chat.Chat_id;

    if (toolId) {
      const toolRes = await fetchWithSpinner(`/gereedschap?id=${toolId}`);
      const tools = await toolRes.json();
      TOOL_BORG = tools[0]?.BorgBedrag ?? 0;

      const toolOwnerId = tools[0]?.Account_id;

      // ✅ Forceer beide naar number voor vergelijking
      IS_OWNER = Number(toolOwnerId) === Number(CURRENT_USER_ID);

      // 🔍 Debug — verwijder dit als het werkt
      console.log('Tool owner ID:', toolOwnerId, typeof toolOwnerId);
      console.log('Current user ID:', CURRENT_USER_ID, typeof CURRENT_USER_ID);
      console.log('IS_OWNER:', IS_OWNER);
    }

  } catch (err) {
    console.error('Chat starten mislukt:', err);
  }
}

async function addMessageToUI(message) {
  const box = document.getElementById("chat-box");
  const div = document.createElement("div");
  const isMe = message.senderId === CURRENT_USER_ID;
  div.className = isMe ? 'my-message' : 'their-message';

  if (!message.type || message.type === "text") {
    div.textContent = `${isMe ? 'Jij' : 'Partner'}: ${message.content}`;
  }

if (message.type === "appointment") {
  const res = await fetchWithSpinner(`/uitleen/${message.uitleenId}`);
  const uitleen = await res.json();

  // Datum + tijd netjes formatteren
  const fmt = (iso) => new Date(iso).toLocaleString('nl-NL', {
    dateStyle: 'short', timeStyle: 'short'
  });

  div.innerHTML = `
    <div data-uitleen-id="${uitleen.Uitleen_id}" style="border:1px solid #ccc; padding:10px; border-radius:10px;">
      <p><b>📅 Afspraak</b></p>
      <p>Borg: €${uitleen.BorgBedrag}</p>
      <p>Van: ${uitleen.StartDatum.split('T')[0]} ${uitleen.StartTijd ?? ''}</p>
      <p>Tot: ${uitleen.EindDatum.split('T')[0]} ${uitleen.EindTijd ?? ''}</p>
      <p>📍 ${uitleen.Adres ?? 'Geen adres opgegeven'}</p>
      ${
        uitleen.Status === "pending" && !isMe
          ? `
            <button onclick="respond(${uitleen.Uitleen_id}, 'accept')">Accepteren</button>
            <button onclick="respond(${uitleen.Uitleen_id}, 'reject')">Weigeren</button>
            <p class="afspraak-status"></p>
          `
          : `<p class="afspraak-status">Status: ${uitleen.Status}</p>`
      }
    </div>
  `;
}

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendMessage(content) {
  if (!socket || !CHAT_ID || !content) return;
  socket.emit("send_message", { chatId: CHAT_ID, content });
}

async function loadMessages() {
  try {
    const res = await fetchWithSpinner(`/messages/chat/${CHAT_ID}`);
    if (!res.ok) throw new Error('Kon berichten niet ophalen');
    const messages = await res.json();
    
    for (const msg of messages) {
      await addMessageToUI(msg);
    }
  } catch (err) {
    console.error(err);
  }
}

function initSocket() {
  socket = io("https://gereedschapspunt.student.open-ict.hu", {
    auth: { userId: CURRENT_USER_ID }
  });

  socket.on("connect", () => {
    console.log(`Verbonden met Socket.IO als user ${CURRENT_USER_ID}`);
    socket.emit("join_chat", { chatId: CHAT_ID });
  });

  socket.on("receive_message", (message) => {
    if (message.Chat_id === CHAT_ID) {
      if (message.type === "appointment") closeModal();
      addMessageToUI(message);
    }
  });

  socket.on("appointment_error", ({ message }) => {
    closeModal();
    alert(message);
  }); // ← accolade sluiten hier

  socket.on("redirect_to_borg", ({ uitleenId }) => {
    window.location.href = `/borg.html?uitleenId=${uitleenId}`;
  });

  socket.on("appointment_updated", (uitleen) => {
  const allDivs = document.querySelectorAll('#chat-box > div');

    for (const div of allDivs) {
      // Voor de ontvanger: zoek via de knoppen
      const acceptBtn = div.querySelector(`button[onclick="respond(${uitleen.Uitleen_id}, 'accept')"]`);
      const rejectBtn = div.querySelector(`button[onclick="respond(${uitleen.Uitleen_id}, 'reject')"]`);

      // Voor de verzender: zoek via data-attribuut
      const isAppointmentDiv = div.querySelector(`[data-uitleen-id="${uitleen.Uitleen_id}"]`);

      if (acceptBtn || rejectBtn) {
        const statusEl = div.querySelector('.afspraak-status');
        if (statusEl) statusEl.textContent = `Status: ${uitleen.Status}`;
        if (acceptBtn) acceptBtn.remove();
        if (rejectBtn) rejectBtn.remove();
        break;
      }

      if (isAppointmentDiv) {
        const statusEl = div.querySelector('.afspraak-status');
        if (statusEl) statusEl.textContent = `Status: ${uitleen.Status}`;
        break;
      }
    }
  });

  socket.on("disconnect", () => console.log("Socket.IO verbinding verbroken"));
}

document.addEventListener("DOMContentLoaded", async () => {
  await getCurrentUserId();
  await getChatInfo();

  console.log('CURRENT_USER_ID:', CURRENT_USER_ID);
  console.log('CHAT_ID:', CHAT_ID);

  if (!CURRENT_USER_ID || !CHAT_ID) {
    console.error('Initialisatie mislukt: gebruiker of chat ontbreekt');
    return;
  }

  initSocket();
  await loadMessages();

  const sendBtn = document.getElementById("send-btn");
  const input = document.getElementById("chat-input");

  const afspraakBtn = document.getElementById("afspraak-btn");
  if (afspraakBtn) {
    afspraakBtn.style.display = IS_OWNER ? "inline-block" : "none";
  }

  sendBtn.addEventListener("click", () => {
    const content = input.value.trim();
    if (!content) return;
    sendMessage(content);
    input.value = '';
  });

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

window.respond = function(uitleenId, action) {
  socket.emit("respond_appointment", { uitleenId, action });
};

window.openModal = function() {
  document.getElementById("modal-borg").textContent = TOOL_BORG ?? 0;
  document.getElementById("modal").style.display = "block";
};

window.closeModal = function() {
  document.getElementById("modal").style.display = "none";
};

window.sendAppointment = function() {
  const startDate = document.getElementById("startDate").value;
  const startTime = document.getElementById("startTime").value;
  const endDate = document.getElementById("endDate").value;
  const endTime = document.getElementById("endTime").value;
  const address = document.getElementById("appointmentAddress").value.trim();

  if (!startDate || !startTime || !endDate || !endTime) {
    return showToast("Vul alle datum- en tijdvelden in", "error");
  }
  if (!address) {
    return showToast("Vul een ophaaladres in", "error");
  }
  if (!CHAT_ID) return showToast("Geen chat geselecteerd", "error");

  socket.emit("send_appointment", {
    chatId: CHAT_ID,
    startDate,
    startTime,
    endDate,
    endTime,
    address
  });
};