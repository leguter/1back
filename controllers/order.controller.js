const { z } = require("zod");
const { createOrder, listMyOrders, getOrderById, confirmOrder } = require("../services/order.service");

const createOrderBodySchema = z.object({
  lotId: z.string().min(1),
});

async function create(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const { lotId } = req.validated.body;
    const order = await createOrder(userId, lotId);
    res.status(201).json({ success: true, order });
  } catch (e) {
    next(e);
  }
}

async function listMine(req, res, next) {
  try {
    const orders = await listMyOrders(req.user.sub || req.user.id);
    res.json({ success: true, orders });
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const order = await getOrderById(req.params.id, req.user.sub || req.user.id);
    res.json({ success: true, order });
  } catch (e) {
    next(e);
  }
}

async function confirm(req, res, next) {
  try {
    const order = await confirmOrder(req.params.id, req.user.sub || req.user.id);
    res.json({ success: true, order });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  create,
  listMine,
  getOne,
  confirm,
  createOrderBodySchema,
};
