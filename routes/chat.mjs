import { Router } from 'express';
import prisma from '../prismaClient.mjs';
import { isLoggedIn } from '../middleware/auth.mjs';
import validate from '../middleware/validate.mjs';
import { chatStartValidator } from '../validators/chatValidator.mjs';
import { chatIdParamValidator, userIdParamValidator } from '../validators/idParamValidator.mjs';
import asyncHandler from '../middleware/asyncHandler.mjs';
import AppError from '../utils/appError.mjs';

const router = Router();

// ── Mijn chats ophalen ──
router.get('/mijn-chats', isLoggedIn, asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  const chats = await prisma.chats.findMany({
    where: { OR: [{ SenderId: userId }, { ReceiverId: userId }] },
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
}));

// ── Chat starten ──
router.post('/chat/start', isLoggedIn, chatStartValidator, validate, asyncHandler(async (req, res) => {
  const { partnerId, toolId } = req.body;
  const userId = req.session.userId;

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
        receiverName:  receiver.Name,
        senderName:    sender.Name
      })
    }).catch(err => console.error('E-mailnotificatie voor nieuwe chat mislukt:', err));
  }

  res.json({ ...chat, isNew });
}));

// ── Berichten van een chat ophalen ──
router.get('/messages/chat/:chatId', isLoggedIn, chatIdParamValidator, validate, asyncHandler(async (req, res) => {
  const chatId = parseInt(req.params.chatId);

  const messages = await prisma.berichten.findMany({
    where: { Chat_id: chatId },
    orderBy: { id: 'asc' }
  });

  res.json(messages);
}));

// ── Chat ophalen op ID ──
router.get('/chat/:chatId', isLoggedIn, chatIdParamValidator, validate, asyncHandler(async (req, res, next) => {
  const chatId = parseInt(req.params.chatId);

  const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
  if (!chat) return next(new AppError('Chat niet gevonden', 404));

  res.json(chat);
}));

// ── Berichten tussen twee gebruikers ophalen ──
router.get('/messages/:userId', isLoggedIn, userIdParamValidator, validate, asyncHandler(async (req, res) => {
  const currentUserId = req.session.userId;
  const otherUserId   = parseInt(req.params.userId);

  const messages = await prisma.berichten.findMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId,   receiverId: currentUserId }
      ]
    },
    orderBy: { id: 'asc' }
  });

  res.json(messages);
}));

// ── Chat verwijderen ──
router.delete('/chat/:chatId', isLoggedIn, chatIdParamValidator, validate, asyncHandler(async (req, res, next) => {
  const chatId = parseInt(req.params.chatId);
  const userId = req.session.userId;

  const chat = await prisma.chats.findUnique({ where: { Chat_id: chatId } });
  if (!chat) return next(new AppError('Chat niet gevonden', 404));

  if (chat.SenderId !== userId && chat.ReceiverId !== userId) {
    return next(new AppError('Je hebt geen toegang om deze chat te verwijderen', 403));
  }

  await prisma.berichten.deleteMany({ where: { Chat_id: chatId } });
  await prisma.chats.delete({ where: { Chat_id: chatId } });

  res.json({ message: 'Chat verwijderd' });
}));

export default router;
