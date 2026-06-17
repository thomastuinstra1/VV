import prisma from '../prismaClient.mjs';

/**
 * Maakt een standaardbericht aan voor een nieuw gestarte chat.
 * De verzender is degene die de chat gestart is (de lener),
 * de inhoud verwijst naar de naam van het gereedschap.
 *
 * @param {Object} params
 * @param {number} params.chatId      - Het Chat_id van de net aangemaakte chat
 * @param {number} params.senderId    - De gebruiker die de chat gestart heeft (lener)
 * @param {number} params.receiverId  - De ontvanger (eigenaar van het gereedschap)
 * @param {string} params.toolName    - De naam van het gereedschap
 * @returns {Promise<Object>} het aangemaakte bericht
 */
export async function createWelcomeMessage({ chatId, senderId, receiverId, toolName }) {
  const content = toolName
    ? `Hoi, ik heb interesse in ${toolName}!`
    : `Hoi, ik heb interesse in je gereedschap!`;

  const message = await prisma.berichten.create({
    data: {
      senderId,
      receiverId,
      content,
      Chat_id: chatId,
      type: "text"
    }
  });

  return message;
}
