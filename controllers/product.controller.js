const { z } = require("zod");
const { listProducts, getProductById, createProduct } = require("../services/product.service");

const createProductBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().int().positive(),
  category: z.string().min(1).max(100),
});

async function getAll(req, res, next) {
  try {
    const products = await listProducts();
    res.json({ success: true, products });
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const product = await getProductById(req.params.id);
    res.json({ success: true, product });
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const product = await createProduct(req.validated.body);
    res.status(201).json({ success: true, product });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getAll,
  getOne,
  create,
  createProductBodySchema,
};
