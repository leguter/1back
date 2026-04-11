const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");

async function createOrder(userId, productId) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppError(404, "Product not found");
    }
    if (product.isSold) {
      throw new AppError(409, "Product already sold");
    }

    const existingPending = await tx.order.findFirst({
      where: {
        userId,
        productId,
        status: "pending",
      },
    });
    if (existingPending) {
      throw new AppError(409, "You already have a pending order for this product");
    }

    return tx.order.create({
      data: {
        userId,
        productId,
        status: "pending",
      },
      include: { product: true },
    });
  });
}

async function listOrdersForUser(userId) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });
}

async function getOrderForUser(orderId, userId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { product: true },
  });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  return order;
}

module.exports = { createOrder, listOrdersForUser, getOrderForUser };
