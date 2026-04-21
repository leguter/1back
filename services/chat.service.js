const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");

async function listMessages(orderId, userId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new AppError(404, "Order not found");
  if (order.buyerId !== userId && order.sellerId !== userId) {
    throw new AppError(403, "Access denied");
  }

  return prisma.message.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
}

async function sendMessage(orderId, senderId, text, type = "text") {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new AppError(404, "Order not found");
  
  // For system messages, senderId might be null or a system ID
  if (type === "text" && order.buyerId !== senderId && order.sellerId !== senderId) {
    throw new AppError(403, "Only participants can send messages");
  }

  return prisma.message.create({
    data: {
      orderId,
      senderId: senderId || "system",
      text,
      type,
    },
  });
}

async function sendSystemMessage(orderId, text) {
  return sendMessage(orderId, "system", text, "system");
}

async function getChatList(userId) {
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      lot: true,
      buyer: true,
      seller: true,
      messages: {
        orderBy: { createdAt: "desc" },
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
};
