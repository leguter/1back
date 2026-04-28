const { z } = require("zod");
const { createInvoiceLinkForOrder, processTelegramUpdate, manualConfirmPayment } = require("../services/payment.service");
const { AppError } = require("../utils/AppError");

const createPaymentBodySchema = z.object({
  orderId: z.string().min(1),
});

const manualConfirmBodySchema = z.object({
  orderId: z.string().min(1),
});

async function create(req, res, next) {
  try {
    const result = await createInvoiceLinkForOrder(req.validated.body.orderId, req.user.sub || req.user.id);
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

async function manualConfirm(req, res, next) {
  try {
    const { getEnv } = require("../config/env");
    if (getEnv().nodeEnv === "production") {
      throw new AppError(403, "Not allowed in production");
    }
    const result = await manualConfirmPayment(req.validated.body.orderId, req.user.sub || req.user.id);
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
    const { getEnv } = require("../config/env");
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    const expectedSecret = getEnv().telegramWebhookSecret;
    
    // Validate secret token if we have configured one
    if (expectedSecret && secretToken !== expectedSecret) {
      console.warn("Unauthorized webhook attempt - Invalid Secret Token");
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

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
  manualConfirm,
  webhook,
  createPaymentBodySchema,
  manualConfirmBodySchema,
};
