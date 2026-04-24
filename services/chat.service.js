const { prisma } = require('../utils/prisma');
const { AppError } = require('../utils/AppError');
const { sendPushNotification } = require('../utils/telegram');

// ─── Typing indicator (in-memory, no DB) ────────────────────────────────────
// key: `${orderId}:${userId}` → expiry timestamp (ms)
const typingStore = new Map();
const TYPING_TTL_MS = 4000; // clear after 4 s of silence

function markTyping(orderId, userId) {
  typingStore.set(`${orderId}:${userId}`, Date.now() + TYPING_TTL_MS);
}

/**
 * Returns the userId of whoever in this order (other than `myUserId`) is currently typing,
 * or null if nobody is.
 */
async function getOtherTyping(orderId, myUserId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  const otherId = String(order.buyerId) === String(myUserId)
    ? order.sellerId
    : order.buyerId;

  const key = `${orderId}:${otherId}`;
  const expires = typingStore.get(key);

  if (!expires || Date.now() > expires) {
    typingStore.delete(key);
    return null;
  }
  return otherId;
}

// ─── Messages ────────────────────────────────────────────────────────────────

async function listMessages(orderId, userId) {
  const userIdStr = String(userId);
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'Order not found');
  if (String(order.buyerId) !== userIdStr && String(order.sellerId) !== userIdStr) {
    throw new AppError(403, 'Access denied');
  }
  return prisma.message.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
  });
}

async function sendMessage(orderId, senderId, text, type = 'text') {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lot: true },
  });
  if (!order) throw new AppError(404, 'Order not found');

  if (type === 'text' && order.buyerId !== senderId && order.sellerId !== senderId) {
    throw new AppError(403, 'Only participants can send messages');
  }

  const message = await prisma.message.create({
    data: {
      orderId,
      senderId: senderId || 'system',
      text,
      type,
    },
  });

  // ── Push notification to the other participant ─────────────────────────────
  if (type === 'text' && senderId && senderId !== 'system') {
    const recipientId = String(order.buyerId) === String(senderId)
      ? order.sellerId
      : order.buyerId;

    const lotTitle = order.lot?.title ?? 'your order';
    const preview = text.length > 100 ? text.slice(0, 97) + '…' : text;

    // Fire-and-forget — do NOT await so the response is never delayed
    sendPushNotification(
      recipientId,
      `💬 <b>New message</b> in <i>${lotTitle}</i>\n\n${preview}`,
    ).catch(() => {});
  }

  return message;
}

async function sendSystemMessage(orderId, text) {
  return sendMessage(orderId, 'system', text, 'system');
}

// ─── Chat list (used by GET /api/chats) ────────────────────────────────────

async function getChatList(userId) {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      lot: true,
      buyer: true,
      seller: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return orders.map((order) => ({
    ...order,
    lastMessage: order.messages[0] ?? null,
    messages: undefined, // strip array, keep only lastMessage
  }));
}

module.exports = {
  listMessages,
  sendMessage,
  sendSystemMessage,
  getChatList,
  markTyping,
  getOtherTyping,
};
