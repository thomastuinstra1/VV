
// ── MIJN CHATS ──
export const toMijnChatsResponseDTO = (chats, userId) => {
  return chats.map(chat => {
    const partner =
      chat.SenderId === userId
        ? chat.Account_Chats_ReceiverIdToAccount
        : chat.Account_Chats_SenderIdToAccount;

    return {
      Chat_id: chat.Chat_id,
      Account_id: partner.Account_id,
      Name: partner.Name,
      Afbeelding: partner.Afbeelding,
      Gereedschap_id: chat.Gereedschap_id,
      Gereedschap_naam: chat.Gereedschap?.Naam || ''
    };
  });
};


// ── CHAT START ──
export const toChatStartDTO = (body) => ({
  partnerId: body.partnerId,
  toolId: body.toolId
});

export const toChatStartResponseDTO = (chat, isNew) => ({
  Chat_id: chat.Chat_id,
  SenderId: chat.SenderId,
  ReceiverId: chat.ReceiverId,
  Gereedschap_id: chat.Gereedschap_id,
  CreatedAt: chat.CreatedAt,
  isNew
});


// ── BERICHTEN ──
export const toBerichtResponseDTO = (messages) => {
  return messages.map(m => ({
    id: m.id,
    content: m.content,
    senderId: m.senderId,
    receiverId: m.receiverId,
    createdAt: m.createdAt,
    type: m.type,
    uitleenId: m.uitleenId,
    Chat_id: m.Chat_id
  }));
};


// ── CHAT ──
export const toChatResponseDTO = (chat) => ({
  Chat_id: chat.Chat_id,
  SenderId: chat.SenderId,
  ReceiverId: chat.ReceiverId,
  Gereedschap_id: chat.Gereedschap_id,
  CreatedAt: chat.CreatedAt
});
