import { Router } from 'express';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';

const router = Router();

// ── Mijn chats ophalen ──
router.get('/mijn-chats', isLoggedIn, async (req, res) => {
  const userId = req.session.userId;
  try {
    const chats = await prisma.chats.findMany({
      where: {
        OR: [{ SenderId: userId }, { ReceiverId: userId }]
      },
      include: {
        Account_Chats_SenderIdToAccount: true,
        Account_Chats_ReceiverIdToAccount: true,
        Gereedschap: true
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const mapped = chats.map(chat => {
      const partner = chat.SenderId === userId
        ? chat.Account_Chats_ReceiverIdToAccount
        : chat.Account_Chats_SenderIdToAccount;

      return {
        Chat_id:          chat.Chat_id,
        Account_id:       partner.Account_id,
        Name:             partner.Name,
        Afbeelding:       partner.Afbeelding,
        Gereedschap_id:   chat.Gereedschap_id,
        Gereedschap_naam: chat.Gereedschap?.Naam || ''
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ophalen mislukt' });
  }
});

// ── Chat starten ──
router.post('/chat/start', isLoggedIn, async (req, res) => {
  const { partnerId, toolId } = req.body;
  const userId = req.session.userId;

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

    let isNew = false;

    if (!chat) {
      chat = await prisma.chats.create({
        data: { SenderId: userId, ReceiverId: partnerId, Gereedschap_id: toolId }
      });
      isNew = true;

      const [sender, receiver] = await Promise.all([
        prisma.account.findUnique({ where: { Account_id: userId }, select: { Name: true } }),
        prisma.account.findUnique({ where: { Account_id: partnerId }, select: { Name: true, E_mail: true } })
      ]);

      fetch(process.env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_chat',
          receiverEmail: receiver.E_mail,
          receiverName: receiver.Name,
          senderName: sender.Name
        })
      }).catch(err => console.error('Email versturen mislukt:', err));
    }

    res.json({ ...chat, isNew });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chat starten mislukt' });
  }
});

// ── Berichten van een chat ophalen ──
router.get('/messages/chat/:chatId', isLoggedIn, async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  if (!chatId) return res.status(400).json({ error: 'Ongeldige chat ID' });

  try {
    const messages = await prisma.berichten.findMany({
      where: { Chat_id: chatId },
      orderBy: { id: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Berichten ophalen mislukt' });
  }
});

// ── Chat ophalen op ID ──
router.get('/chat/:chatId', isLoggedIn, async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  try {
    const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
    if (!chat) return res.status(404).json({ error: 'Chat niet gevonden' });
    res.json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chat ophalen mislukt' });
  }
});

// ── Berichten tussen twee gebruikers ophalen ──
router.get('/messages/:userId', isLoggedIn, async (req, res) => {
  const currentUserId = req.session.userId;
  const otherUserId = parseInt(req.params.userId);
  if (!otherUserId) return res.status(400).json({ error: 'Ongeldige partner ID' });

  try {
    const messages = await prisma.berichten.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId }
        ]
      },
      orderBy: { id: 'asc' }
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kon berichten niet ophalen' });
  }
});

// ── Chat verwijderen ──
router.delete('/chat/:chatId', isLoggedIn, async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  const userId = req.session.userId;

  try {
    const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
    if (!chat) return res.status(404).json({ error: 'Chat niet gevonden' });

    if (chat.SenderId !== userId && chat.ReceiverId !== userId) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    await prisma.berichten.deleteMany({ where: { Chat_id: chatId } });
    await prisma.chats.delete({ where: { Chat_id: chatId } });

    res.json({ message: 'Chat verwijderd' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verwijderen mislukt' });
  }
});

export default router;