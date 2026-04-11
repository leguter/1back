const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");

async function listProducts() {
  return prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });
}

async function getProductById(id) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new AppError(404, "Product not found");
  }
  return product;
}

async function createProduct(data) {
  return prisma.product.create({
    data: {
      title: data.title,
      description: data.description,
      price: data.price,
      category: data.category,
    },
  });
}

module.exports = { listProducts, getProductById, createProduct };
