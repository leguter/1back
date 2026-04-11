const { z } = require("zod");
const { createOrder, listOrdersForUser } = require("../services/order.service");

const createOrderBodySchema = z.object({
  productId: z.string().min(1),
});

async function create(req, res, next) {
  try {
    const userId = req.user.id;
    const { productId } = req.validated.body;
    const order = await createOrder(userId, productId);
    res.status(201).json({ success: true, order });
  } catch (e) {
    next(e);
  }
}

async function listMine(req, res, next) {
  try {
    const orders = await listOrdersForUser(req.user.id);
    res.json({ success: true, orders });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  create,
  listMine,
  createOrderBodySchema,
};
