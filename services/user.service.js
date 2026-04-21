const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");

async function getUserProfile(userId) {
  const raw = String(userId);
  if (!raw) throw new AppError(400, "Valid User ID is required");

  const include = {
    lots: {
      where: { isSold: false },
      orderBy: { createdAt: "desc" },
    },
    _count: {
      select: {
        sellOrders: { where: { status: "completed" } },
      },
    },
  };

  // Try exact id first, then fall back to username
  let user = await prisma.user.findUnique({ where: { id: raw }, include });

  if (!user) {
    user = await prisma.user.findFirst({ where: { username: raw }, include });
  }

  if (!user) throw new AppError(404, "User not found");
  return user;
}

async function getUserBalance(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, pendingBalance: true },
  });
  if (!user) {
    throw new AppError(404, "User not found");
  }
  return user;
}

async function listLotsByUser(userId) {
  return prisma.lot.findMany({
    where: { userId: String(userId) },
    orderBy: { createdAt: "desc" },
  });
}

async function listBuyerOrders(userId) {
  return prisma.order.findMany({
    where: { buyerId: String(userId) },
    orderBy: { createdAt: "desc" },
    include: { lot: true },
  });
}

async function withdrawBalance(userId, amount) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.balance < amount) {
      throw new AppError(400, "Insufficient balance");
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount,
        type: "withdraw",
        status: "completed",
      },
    });

    return updatedUser;
  });
}

module.exports = {
  getUserProfile,
  getUserBalance,
  listLotsByUser,
  listBuyerOrders,
  withdrawBalance,
};
