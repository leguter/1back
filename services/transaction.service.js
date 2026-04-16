const { prisma } = require("../utils/prisma");

async function recordTransaction(userId, amount, type, status = "completed") {
  return prisma.transaction.create({
    data: {
      userId,
      amount,
      type,
      status,
    },
  });
}

async function listTransactions(userId) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  recordTransaction,
  listTransactions,
};
