const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");

async function listLots() {
  return prisma.lot.findMany({
    where: { isSold: false },
    orderBy: { createdAt: "desc" },
    include: { seller: true },
  });
}

async function getLotById(id) {
  const lot = await prisma.lot.findUnique({ 
    where: { id },
    include: { seller: true },
  });
  if (!lot) {
    throw new AppError(404, "Lot not found");
  }
  return lot;
}

async function createLot(userId, data) {
  return prisma.lot.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      price: data.price,
      category: data.category,
    },
  });
}

module.exports = { listLots, getLotById, createLot };
