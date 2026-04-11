const { z } = require("zod");
const { createInvoiceLinkForOrder, processTelegramUpdate } = require("../services/payment.service");

const createPaymentBodySchema = z.object({
  orderId: z.string().min(1),
});

async function create(req, res, next) {
  try {
    const result = await createInvoiceLinkForOrder(req.validated.body.orderId, req.user.id);
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

/**
 * Telegram Bot API webhook: JSON body { update_id, ... }.
 * Always responds 200 when the update was accepted to avoid retry storms;
 * logs soft failures.
 */
async function webhook(req, res) {
  try {
    const update = req.body;
    if (!update || typeof update !== "object") {
      return res.status(200).json({ ok: true });
    }
    const result = await processTelegramUpdate(update);
    if (result.type === "successful_payment" && result.handled === false) {
      console.warn("payment webhook soft-fail:", result.reason);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("payment webhook error:", e);
    return res.status(500).json({ ok: false });
  }
}

module.exports = {
  create,
  webhook,
  createPaymentBodySchema,
};
