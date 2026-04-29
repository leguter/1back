const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");
const chatService = require("./chat.service");
const transactionService = require("./transaction.service");

const COMMISSION_RATE = 0.10; // 10% platform commission

async function createOrder(buyerId, lotId, quantity = 1) {
  const buyerIdStr = String(buyerId);
  const lotIdStr = String(lotId);
  const qty = Math.max(1, Math.floor(Number(quantity)));

  return prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUnique({ where: { id: lotIdStr } });
    if (!lot) throw new AppError(404, 'Lot not found');
    if (lot.isSold) throw new AppError(409, 'Lot already sold');
    if (lot.stockCount < qty) throw new AppError(400, `Only ${lot.stockCount} account(s) available`);

    // Prevent self-purchase
    if (String(lot.userId) === buyerIdStr) {
      throw new AppError(400, 'You cannot buy your own listing');
    }

    // Return existing pending order (idempotent, same quantity)
    const existingPending = await tx.order.findFirst({
      where: { buyerId: buyerIdStr, lotId: lotIdStr, status: 'pending', quantity: qty },
      include: { lot: true },
    });
    if (existingPending) return existingPending;

    const totalAmount = lot.price * qty;
    const sellerAmount = Math.floor(totalAmount * (1 - COMMISSION_RATE));

    try {
      return await tx.order.create({
        data: {
          buyerId: buyerIdStr,
          sellerId: String(lot.userId),
          lotId: lotIdStr,
          amount: totalAmount,
          sellerAmount,
          quantity: qty,
          status: 'pending',
        },
        include: { lot: true },
      });
    } catch (err) {
      console.error('[createOrder] Failed to create order:', err.message);
      throw new AppError(500, err.message || 'Failed to create order');
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

  // 2. Add to seller's pending balance (only the sellerAmount, not full amount)
  await tx.user.update({
    where: { id: order.sellerId },
    data: { pendingBalance: { increment: order.sellerAmount } },
  });

  // 4. Create HOLD transaction for seller
  await tx.transaction.create({
    data: {
      userId: order.sellerId,
      amount: order.sellerAmount,
      type: 'hold',
      status: 'completed',
    },
  });

  // 5. Decrement lot stockCount; mark sold if depleted
  const updatedLot = await tx.lot.update({
    where: { id: order.lotId },
    data: { stockCount: { decrement: order.quantity } },
  });
  if (updatedLot.stockCount <= 0) {
    await tx.lot.update({ where: { id: order.lotId }, data: { isSold: true } });
  }

  // 6. Send automated confirmation messages
  await chatService.sendSystemMessage(
    order.id,
    `✅ <b>Payment completed</b> for ${order.quantity} item${order.quantity > 1 ? 's' : ''}.\nTotal: ⭐ ${order.amount}\n\nFunds are held in escrow. Seller, please provide the items in this chat.`
  );

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

    // 2. Move money: pending → available (sellerAmount = after commission)
    const releaseAmount = order.sellerAmount || order.amount; // fallback for old orders
    await tx.user.update({
      where: { id: order.sellerId },
      data: {
        pendingBalance: { decrement: releaseAmount },
        balance: { increment: releaseAmount },
      },
    });

    // 3. Create RELEASE transaction for seller
    await tx.transaction.create({
      data: {
        userId: order.sellerId,
        amount: releaseAmount,
        type: 'release',
        status: 'completed',
      },
    });

    // 4. Add system message (shows both amounts)
    const commission = order.amount - releaseAmount;
    await tx.message.create({
      data: {
        orderId,
        senderId: 'system',
        text: `🎉 Order confirmed! Seller receives ⭐ ${releaseAmount} (platform fee: ⭐ ${commission}).`,
        type: 'system',
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
    include: { lot: true, buyer: true, seller: true, review: true },
  });
  if (!order) throw new AppError(404, "Order not found");
  if (String(order.buyerId) !== userIdStr && String(order.sellerId) !== userIdStr) {
    throw new AppError(403, "Access denied");
  }
  return order;
}

/**
 * Auto-confirm paid orders older than `hoursThreshold` that have no open dispute.
 * Called by a background cron so sellers are never locked out permanently.
 */
async function autoConfirmPaidOrders(hoursThreshold = 72) {
  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: 'paid',
      createdAt: { lte: cutoff },
      dispute: { is: null }, // skip orders that have a dispute open
    },
    select: { id: true, buyerId: true },
  });

  let confirmed = 0;
  for (const order of staleOrders) {
    try {
      await confirmOrder(order.id, order.buyerId);
      confirmed++;
      console.log(`[auto-confirm] Order ${order.id} auto-confirmed after ${hoursThreshold}h`);
    } catch (e) {
      console.warn(`[auto-confirm] Failed to confirm order ${order.id}:`, e.message);
    }
  }

  if (confirmed > 0) {
    console.log(`[auto-confirm] Auto-confirmed ${confirmed} stale paid order(s)`);
  }
  return confirmed;
}

module.exports = {
  createOrder,
  handlePayment,
  _handlePaymentTx,
  confirmOrder,
  listMyOrders,
  listBuyerOrders,
  getOrderById,
  autoConfirmPaidOrders,
};
