const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");

async function getUserProfile(userId) {
  const id = String(userId);
  if (!id) throw new AppError(400, "Valid User ID is required");

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      lots: { where: { isSold: false } },
      buyOrders: { include: { lot: true } },
      sellOrders: { include: { lot: true } },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }
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
