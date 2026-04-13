import prisma from '../prismaClient.mjs';

export function initSocket(io) {
  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;

    if (!userId) {
      console.log("Geen userId, verbinding verbroken");
      socket.disconnect();
      return;
    }

    console.log(`User ${userId} verbonden via Socket.IO`);
    socket.join(userId);

    // ── Chat joinen ──
    socket.on("join_chat", ({ chatId }) => {
      socket.join(`chat_${chatId}`);
      console.log(`User ${userId} joined chat_${chatId}`);
    });

    // ── Chat starten ──
    socket.on("start_chat", async ({ partnerId, toolId }) => {
      try {
        let chat = await prisma.chats.findFirst({
          where: {
            Gereedschap_id: toolId,
            OR: [
              { SenderId: userId, ReceiverId: partnerId },
              { SenderId: partnerId, ReceiverId: userId }
            ]
          }
        });

        if (!chat) {
          chat = await prisma.chats.create({
            data: { SenderId: userId, ReceiverId: partnerId, Gereedschap_id: toolId }
          });
        }

        socket.join(`chat_${chat.Chat_id}`);
        io.to(`chat_${chat.Chat_id}`).emit("chat_started", chat);
      } catch (err) {
        console.error("Fout bij starten chat:", err);
      }
    });

    // ── Bericht versturen ──
    socket.on("send_message", async ({ chatId, content }) => {
      try {
        const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
        if (!chat) return;

        const toUserId = chat.SenderId === userId ? chat.ReceiverId : chat.SenderId;

        const message = await prisma.berichten.create({
          data: {
            senderId: userId,
            receiverId: toUserId,
            content,
            Chat_id: chatId,
            type: "text"
          }
        });

        io.to(`chat_${chatId}`).emit("receive_message", message);
      } catch (err) {
        console.error("Fout bij versturen bericht:", err);
      }
    });

    // ── Afspraak versturen ──
    socket.on("send_appointment", async ({ chatId, startDate, endDate }) => {
      try {
        const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
        if (!chat) return;

        const toUserId = chat.SenderId === userId ? chat.ReceiverId : chat.SenderId;

        const tool = await prisma.gereedschap.findUnique({
          where: { Gereedschap_id: chat.Gereedschap_id }
        });

        const overlap = await prisma.uitleen.findFirst({
          where: {
            Gereedschap_id: tool.Gereedschap_id,
            Status: { in: ['pending', 'accepted'] },
            StartDatum: { lte: new Date(endDate) },
            EindDatum:  { gte: new Date(startDate) }
          }
        });

        if (overlap) {
          socket.emit("appointment_error", {
            message: "Dit gereedschap is al uitgeleend in deze periode."
          });
          return;
        }

        const lenerId = userId === tool.Account_id ? toUserId : userId;

        const uitleen = await prisma.uitleen.create({
          data: {
            Account_id:     tool.Account_id,
            Lener_id:       lenerId,
            Gereedschap_id: tool.Gereedschap_id,
            StartDatum:     new Date(startDate),
            EindDatum:      new Date(endDate),
            BorgBedrag:     tool.BorgBedrag ?? 0,
            Status:         "pending"
          }
        });

        const message = await prisma.berichten.create({
          data: {
            senderId:   userId,
            receiverId: toUserId,
            content:    "Afspraak verzoek",
            type:       "appointment",
            Chat_id:    chatId,
            uitleenId:  uitleen.Uitleen_id
          }
        });

        io.to(`chat_${chatId}`).emit("receive_message", message);
      } catch (err) {
        console.error("Fout bij afspraak:", err);
      }
    });

    // ── Reageren op afspraak ──
    socket.on("respond_appointment", async ({ uitleenId, action }) => {
      try {
        const status = action === "accept" ? "accepted" : "rejected";
        const updated = await prisma.uitleen.update({
          where: { Uitleen_id: uitleenId },
          data: { Status: status }
        });

        const bericht = await prisma.berichten.findFirst({
          where: { uitleenId: uitleenId }
        });

        if (bericht) {
          io.to(`chat_${bericht.Chat_id}`).emit("appointment_updated", updated);
        }
      } catch (err) {
        console.error("Fout bij reageren op afspraak:", err);
      }
    });

    // ── Verbinding verbroken ──
    socket.on("disconnect", () => {
      console.log(`User ${userId} heeft verbinding verbroken`);
    });
  });
}