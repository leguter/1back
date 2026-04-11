const { Prisma } = require("@prisma/client");
const { getEnv } = require("../config/env");
const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");

const TELEGRAM_API = "https://api.telegram.org";

async function telegramApi(method, body) {
  const { telegramBotToken } = getEnv();
  const res = await fetch(`${TELEGRAM_API}/bot${telegramBotToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const desc = data.description || res.statusText || "Telegram API error";
    throw new AppError(502, desc, "telegram_api_error");
  }
  return data.result;
}

/**
 * Create Stars invoice link for a pending order owned by the user.
 */
async function createInvoiceLinkForOrder(orderId, userId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { product: true },
  });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError(409, "Order is not payable");
  }
  if (order.product.isSold) {
    throw new AppError(409, "Product already sold");
  }

  const payload = order.id;
  const title = order.product.title.slice(0, 32);
  const description = order.product.description.slice(0, 255);

  const invoiceLink = await telegramApi("createInvoiceLink", {
    title,
    description,
    payload,
    currency: "XTR",
    prices: [{ label: order.product.title.slice(0, 50), amount: order.product.price }],
  });

  return { invoiceLink, orderId: order.id };
}

/**
 * Answer pre_checkout_query (must match pending order and price).
 */
async function handlePreCheckoutQuery(query) {
  const payload = query.invoice_payload;
  const currency = query.currency;
  const totalAmount = query.total_amount;

  if (currency !== "XTR") {
    await telegramApi("answerPreCheckoutQuery", {
      pre_checkout_query_id: query.id,
      ok: false,
      error_message: "Invalid currency",
    });
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: payload },
    include: { product: true },
  });

  const payerId = query.from?.id;
  if (
    payerId == null ||
    (order && String(payerId) !== order.userId)
  ) {
    await telegramApi("answerPreCheckoutQuery", {
      pre_checkout_query_id: query.id,
      ok: false,
      error_message: "Order unavailable",
    });
    return;
  }

  if (
    !order ||
    order.status !== "pending" ||
    order.product.isSold ||
    order.product.price !== totalAmount
  ) {
    await telegramApi("answerPreCheckoutQuery", {
      pre_checkout_query_id: query.id,
      ok: false,
      error_message: "Order unavailable",
    });
    return;
  }

  await telegramApi("answerPreCheckoutQuery", {
    pre_checkout_query_id: query.id,
    ok: true,
  });
}

/**
 * Finalize successful_payment: idempotent via telegram_payment_charge_id unique.
 * @param {number} payerTelegramId - message.from.id; must match order.userId.
 */
async function handleSuccessfulPayment(sp, payerTelegramId) {
  const payload = sp.invoice_payload;
  const chargeId = sp.telegram_payment_charge_id;
  const currency = sp.currency;
  const totalAmount = sp.total_amount;

  if (!chargeId || currency !== "XTR") {
    return { handled: false, reason: "invalid_payment_payload" };
  }
  if (payerTelegramId == null || typeof payerTelegramId !== "number") {
    return { handled: false, reason: "missing_payer" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: payload },
        include: { product: true },
      });

      if (!order) {
        throw new Error("order_not_found");
      }

      if (String(payerTelegramId) !== order.userId) {
        throw new Error("payer_mismatch");
      }

      if (order.status === "paid") {
        return;
      }

      if (order.status === "failed" || order.product.isSold) {
        throw new Error("order_invalid_state");
      }

      if (order.product.price !== totalAmount) {
        throw new Error("amount_mismatch");
      }

      const existing = await tx.payment.findUnique({
        where: { telegramPaymentChargeId: chargeId },
      });
      if (existing) {
        return;
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "telegram",
          status: "completed",
          telegramPaymentChargeId: chargeId,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "paid" },
      });

      await tx.product.update({
        where: { id: order.productId },
        data: { isSold: true },
      });
    });

    return { handled: true };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      Array.isArray(e.meta?.target) &&
      e.meta.target.includes("telegram_payment_charge_id")
    ) {
      return { handled: true, duplicate: true };
    }
    if (e.message === "order_not_found") {
      return { handled: false, reason: "order_not_found" };
    }
    if (
      e.message === "order_invalid_state" ||
      e.message === "amount_mismatch" ||
      e.message === "payer_mismatch"
    ) {
      return { handled: false, reason: e.message };
    }
    throw e;
  }
}

async function processTelegramUpdate(update) {
  if (update.pre_checkout_query) {
    await handlePreCheckoutQuery(update.pre_checkout_query);
    return { type: "pre_checkout" };
  }

  const sp = update.message?.successful_payment;
  if (sp) {
    const payerId = update.message?.from?.id;
    const r = await handleSuccessfulPayment(sp, payerId);
    return { type: "successful_payment", ...r };
  }

  return { type: "ignored" };
}

module.exports = {
  createInvoiceLinkForOrder,
  processTelegramUpdate,
};
