const { prisma } = require('../utils/prisma');
const { AppError } = require('../utils/AppError');

async function openDispute(orderId, userId, reason) {
  const { ensureSupportUser } = require('./auth.service');
  const userIdStr = String(userId);

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'Order not found');
  if (order.buyerId !== userIdStr && order.sellerId !== userIdStr) {
    throw new AppError(403, 'Access denied');
  }
  if (order.status !== 'paid') {
    throw new AppError(400, 'You can only open a dispute on a paid order');
  }

  const existing = await prisma.dispute.findUnique({ where: { orderId } });
  if (existing) throw new AppError(409, 'A dispute is already open for this order');

  const supportUser = await ensureSupportUser();

  return prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.create({
      data: { orderId, openedBy: userIdStr, reason },
    });

    // Mark order as disputed
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'disputed' },
    });

    // Post a system message so both parties see it in chat
    await tx.message.create({
      data: {
        orderId,
        senderId: 'system',
        text: '⚠️ A dispute has been opened for this order. Our support team will review and resolve it shortly.',
        type: 'system',
      },
    });

    // Support joins the chat
    await tx.message.create({
      data: {
        orderId,
        senderId: supportUser.id,
        text: 'Hello, support has joined the chat. Please describe your issue.',
        type: 'text',
      },
    });

    return dispute;
  });
}

async function resolveDispute(orderId, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.username !== "StarcSupport") {
    throw new AppError(403, "Only support can resolve disputes");
  }

  return prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: "completed", isConfirmed: true, completedAt: new Date() },
    });

    await tx.dispute.update({
      where: { orderId },
      data: { status: "resolved", resolvedAt: new Date() },
    });

    await tx.message.create({
      data: {
        orderId,
        senderId: 'system',
        text: '✅ Complaint resolved. Order marked as completed.',
        type: 'system',
      },
    });
  });
}

async function listDisputedOrders() {
  return prisma.order.findMany({
    where: { status: "disputed" },
    include: {
      lot: true,
      buyer: { select: { id: true, username: true, firstName: true } },
      seller: { select: { id: true, username: true, firstName: true } },
      dispute: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = { openDispute, resolveDispute, listDisputedOrders };
