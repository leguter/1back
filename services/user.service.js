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

const FAST_WITHDRAW_MIN_DAYS = 2;
const FREE_WITHDRAW_DAYS     = 20;
const FAST_WITHDRAW_FEE      = 0.10; // 10 %

async function getWithdrawEligibility(userId) {
  const id = String(userId);

  // Find the most recently completed sell order for this seller
  const lastCompleted = await prisma.order.findFirst({
    where: { sellerId: id, status: "completed" },
    orderBy: { completedAt: "desc" },
  });

  const now = new Date();

  if (!lastCompleted || !lastCompleted.completedAt) {
    // No completed orders yet — use createdAt as fallback (always "too new")
    return { eligible: false, daysElapsed: 0, fee: 0, mode: "none" };
  }

  const completed = new Date(lastCompleted.completedAt);
  const msElapsed = now - completed;
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);

  if (daysElapsed < FAST_WITHDRAW_MIN_DAYS) {
    return { eligible: false, daysElapsed, fee: 0, mode: "locked" };
  }
  if (daysElapsed < FREE_WITHDRAW_DAYS) {
    return { eligible: true, daysElapsed, fee: FAST_WITHDRAW_FEE, mode: "fast" };
  }
  return { eligible: true, daysElapsed, fee: 0, mode: "free" };
}

async function withdrawBalance(userId, amount, mode) {
  const id = String(userId);
  const eligibility = await getWithdrawEligibility(id);

  if (!eligibility.eligible) {
    const daysLeft = Math.ceil(FAST_WITHDRAW_MIN_DAYS - eligibility.daysElapsed);
    throw new AppError(
      400,
      `Funds are locked. Fast withdraw available in ${daysLeft} day(s).`
    );
  }

  const fee       = Math.floor(amount * eligibility.fee);
  const netAmount = amount - fee;   // what user actually receives

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user || user.balance < amount) {
      throw new AppError(400, "Insufficient balance");
    }

    const updatedUser = await tx.user.update({
      where: { id },
      data: { balance: { decrement: amount } },
    });

    await tx.transaction.create({
      data: {
        userId: id,
        amount: netAmount,
        type: "withdraw",
        status: "completed",
      },
    });

    if (fee > 0) {
      // Record the platform fee separately for accounting
      await tx.transaction.create({
        data: {
          userId: id,
          amount: fee,
          type: "withdraw_fee",
          status: "completed",
        },
      });
    }

    return { user: updatedUser, fee, netAmount, mode: eligibility.mode };
  });
}

async function updateUserProfile(userId, requestorId, data) {
  if (String(userId) !== String(requestorId)) {
    throw new AppError(403, "You can only edit your own profile");
  }
  const updated = await prisma.user.update({
    where: { id: String(userId) },
    data: {
      ...(data.bio   !== undefined && { bio: data.bio }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.username !== undefined && { username: data.username }),
    },
  });
  return updated;
}

module.exports = {
  getUserProfile,
  getUserBalance,
  listLotsByUser,
  listBuyerOrders,
  withdrawBalance,
  updateUserProfile,
  getWithdrawEligibility,
};
