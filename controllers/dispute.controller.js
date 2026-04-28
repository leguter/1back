const { z } = require('zod');
const { openDispute } = require('../services/dispute.service');

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

module.exports = { open, openDisputeBodySchema };
