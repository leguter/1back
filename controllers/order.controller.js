const { z } = require("zod");
const { createOrder, listMyOrders, listBuyerOrders, getOrderById, confirmOrder } = require("../services/order.service");

// Схема залишається такою ж, лот — це основа замовлення/чату
const createOrderBodySchema = z.object({
  lotId: z.string().min(1),
});

/**
 * Крок 1: Створення замовлення (відкриття чату)
 * Тепер цей метод викликається, коли користувач натискає "Написати продавцю"
 */
async function create(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const { lotId } = req.validated.body;
    
    // createOrder має бути розумним: якщо чат уже існує (pending), 
    // він має повернути існуючий, а не створювати дублікат.
    const order = await createOrder(userId, lotId);
    
    res.status(201).json({ success: true, order });
  } catch (e) {
    next(e);
  }
}

/**
 * Крок 2: Отримання списку чатів/угод
 * Важливо, щоб сервіс listMyOrders повертав замовлення, 
 * де користувач і як покупець, і як продавець.
 */
async function listMine(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const orders = await listMyOrders(userId);
    res.json({ success: true, orders });
  } catch (e) {
    next(e);
  }
}

/**
 * Крок 3: Підтвердження отримання товару (Escrow завершення)
 * Викликається покупцем ПІСЛЯ того, як продавець видав товар у чаті.
 */
async function confirm(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const orderId = req.params.id;
    const order = await confirmOrder(orderId, userId);
    res.json({ success: true, order });
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

async function listBuyer(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const orders = await listBuyerOrders(userId);
    res.json({ success: true, orders });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  create,
  listMine,
  listBuyer,
  getOne,
  confirm,
  createOrderBodySchema,
};
