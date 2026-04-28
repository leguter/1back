const { prisma } = require('../utils/prisma');
const { AppError } = require('../utils/AppError');

async function openDispute(orderId, userId, reason) {
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
        text: '⚠️ A dispute has been opened for this order. Our support team will review and resolve it shortly. Please do not send account credentials until the dispute is resolved.',
        type: 'system',
      },
    });

    return dispute;
  });
}

module.exports = { openDispute };
