const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");
const chatService = require("./chat.service");
const transactionService = require("./transaction.service");

async function createOrder(buyerId, lotId) {
  const buyerIdStr = String(buyerId);
  const lotIdStr = String(lotId);

  return prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({ where: { id: lotIdStr } });
    if (!lot) throw new AppError(404, "Lot not found");
    if (lot.isSold) throw new AppError(409, "Lot already sold");

    // Prevent self-purchase
    if (String(lot.userId) === buyerIdStr) {
      throw new AppError(400, "You cannot buy your own listing");
    }

    // 1. Return existing pending order (idempotent)
    const existingPending = await tx.order.findFirst({
      where: { buyerId: buyerIdStr, lotId: lotIdStr, status: "pending" },
      include: { lot: true },
    });
    if (existingPending) return existingPending;

    // 2. Create new order
    try {
      return await tx.order.create({
        data: {
          buyerId: buyerIdStr,
          sellerId: String(lot.userId),
          lotId: lotIdStr,
          amount: lot.price,
          status: "pending",
        },
        include: { lot: true },
      });
    } catch (err) {
      console.error('[createOrder] Failed to create order:', {
        buyerIdStr,
        sellerId: String(lot.userId),
        lotIdStr,
        errCode: err.code,
        errMessage: err.message,
      });
      throw new AppError(500, err.message || "Failed to create order");
    }
  });
}

async function _handlePaymentTx(orderId, tx) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { lot: true },
  });

  if (!order || order.status !== "pending") {
    throw new AppError(400, "Order cannot be paid");
  }

  // 1. Update order status
  const updatedOrder = await tx.order.update({
    where: { id: orderId },
    data: { status: "paid" },
  });

  // 2. Mark lot as sold
  await tx.lot.update({
    where: { id: order.lotId },
    data: { isSold: true },
  });

  // 3. Add to seller's pending balance
  await tx.user.update({
    where: { id: order.sellerId },
    data: { pendingBalance: { increment: order.amount } },
  });

  // 4. Create HOLD transaction for seller
  await tx.transaction.create({
    data: {
      userId: order.sellerId,
      amount: order.amount,
      type: "hold",
      status: "completed",
    },
  });

  // 5. Add system message
  await tx.message.create({
    data: {
      orderId,
      senderId: "system",
      text: "Payment has been made. The funds are held in escrow.",
      type: "system",
    },
  });

  return updatedOrder;
}

async function handlePayment(orderId) {
  return prisma.$transaction((tx) => _handlePaymentTx(orderId, tx));
}


async function confirmOrder(orderId, buyerId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.buyerId !== buyerId) throw new AppError(403, "Access denied");
    if (order.status !== "paid") throw new AppError(400, "Order must be paid first");

    // 1. Update order status + stamp completedAt
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: "completed", isConfirmed: true, completedAt: new Date() },
    });

    // 2. Move money: pending -> available
    await tx.user.update({
      where: { id: order.sellerId },
      data: {
        pendingBalance: { decrement: order.amount },
        balance: { increment: order.amount },
      },
    });

    // 3. Create RELEASE transaction for seller
    await tx.transaction.create({
      data: {
        userId: order.sellerId,
        amount: order.amount,
        type: "release",
        status: "completed",
      },
    });

    // 4. Add system message
    await tx.message.create({
      data: {
        orderId,
        senderId: "system",
        text: "Order has been confirmed. Funds released to seller.",
        type: "system",
      },
    });

    return updatedOrder;
  });
}

async function listMyOrders(userId) {
  return prisma.order.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { createdAt: "desc" },
    include: { lot: true },
  });
}

async function listBuyerOrders(userId) {
  return prisma.order.findMany({
    where: { buyerId: String(userId) },
    orderBy: { createdAt: "desc" },
    include: { lot: true },
  });
}

async function getOrderById(orderId, userId) {
  const userIdStr = String(userId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lot: true, buyer: true, seller: true },
  });
  if (!order) throw new AppError(404, "Order not found");
  if (String(order.buyerId) !== userIdStr && String(order.sellerId) !== userIdStr) {
    throw new AppError(403, "Access denied");
  }
  return order;
}

module.exports = {
  createOrder,
  handlePayment,
  _handlePaymentTx,
  confirmOrder,
  listMyOrders,
  listBuyerOrders,
  getOrderById,
};
