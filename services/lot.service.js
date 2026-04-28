const { prisma } = require('../utils/prisma');
const { AppError } = require('../utils/AppError');
const { assertNoProfanity } = require('../utils/profanity');

const SUBSCRIBERS_REQUIRED = ['telegram', 'youtube'];

function assertSubscribersCount(category, subscribersCount) {
  if (SUBSCRIBERS_REQUIRED.includes(category) && !subscribersCount) {
    throw new AppError(400, `Subscribers count is required for ${category} listings`, 'validation_error');
  }
}

async function listLots() {
  return prisma.lot.findMany({
    where: { isSold: false },
    orderBy: { createdAt: 'desc' },
    include: { seller: true },
  });
}

async function getLotById(id) {
  const lot = await prisma.lot.findUnique({
    where: { id },
    include: { seller: true },
  });
  if (!lot) throw new AppError(404, 'Lot not found');
  return lot;
}

async function createLot(userId, data) {
  assertNoProfanity(data.title, data.description);
  assertSubscribersCount(data.category, data.subscribersCount);
  return prisma.lot.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      price: data.price,
      category: data.category,
      subscribersCount: data.subscribersCount ? Number(data.subscribersCount) : null,
    },
    include: { seller: true },
  });
}

async function updateLot(lotId, userId, data) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) throw new AppError(404, 'Lot not found');
  if (lot.userId !== String(userId)) throw new AppError(403, 'You are not the owner of this lot');
  if (lot.isSold) throw new AppError(409, 'Cannot edit a sold lot');

  // Prevent editing while buyer has an active order
  const activeOrder = await prisma.order.findFirst({
    where: { lotId, status: { in: ['pending', 'paid', 'disputed'] } },
  });
  if (activeOrder) throw new AppError(409, 'Cannot edit a lot with an active order in progress', 'lot_locked');

  assertNoProfanity(data.title, data.description);
  assertSubscribersCount(data.category, data.subscribersCount);

  return prisma.lot.update({
    where: { id: lotId },
    data: {
      title: data.title,
      description: data.description,
      price: data.price,
      category: data.category,
      subscribersCount: data.subscribersCount ? Number(data.subscribersCount) : null,
    },
    include: { seller: true },
  });
}

async function deleteLot(lotId, userId) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) throw new AppError(404, 'Lot not found');
  if (lot.userId !== String(userId)) throw new AppError(403, 'You are not the owner of this lot');
  if (lot.isSold) throw new AppError(409, 'Cannot delete a sold lot');

  // Prevent deleting while buyer has an active order
  const activeOrder = await prisma.order.findFirst({
    where: { lotId, status: { in: ['pending', 'paid', 'disputed'] } },
  });
  if (activeOrder) throw new AppError(409, 'Cannot delete a lot with an active order in progress', 'lot_locked');

  await prisma.lot.delete({ where: { id: lotId } });
  return { deleted: true };
}

module.exports = { listLots, getLotById, createLot, updateLot, deleteLot };
