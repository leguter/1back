const { z } = require('zod');
const { openDispute, resolveDispute, listDisputedOrders } = require('../services/dispute.service');
const { prisma } = require('../utils/prisma');

const openDisputeBodySchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
});

async function open(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const dispute = await openDispute(req.params.orderId, userId, req.validated.body.reason);
    res.status(201).json({ success: true, dispute });
  } catch (e) {
    next(e);
  }
}

async function resolve(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    await resolveDispute(req.params.orderId, userId);
    res.json({ success: true, message: "Dispute resolved" });
  } catch (e) {
    next(e);
  }
}

async function listDisputed(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.username !== "StarcSupport") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const orders = await listDisputedOrders();
    res.json({ success: true, orders });
  } catch (e) {
    next(e);
  }
}

module.exports = { open, resolve, listDisputed, openDisputeBodySchema };
