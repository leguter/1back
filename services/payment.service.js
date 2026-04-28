const { Prisma } = require("@prisma/client");
const { getEnv } = require("../config/env");
const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");
const { _handlePaymentTx } = require("./order.service");

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

async function createInvoiceLinkForOrder(orderId, userId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerId: userId },
    include: { lot: true },
  });
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError(409, "Order is not payable");
  }
  if (order.lot.isSold) {
    throw new AppError(409, "Lot already sold");
  }

  const payload = order.id;
  const title = order.lot.title.slice(0, 32);
  const description = order.lot.description.slice(0, 255);

  const invoiceLink = await telegramApi("createInvoiceLink", {
    title,
    description,
    payload,
    currency: "XTR",
    prices: [{ label: `${order.lot.title.slice(0, 40)} x${order.quantity}`, amount: order.amount }],
  });

  return { invoiceLink, orderId: order.id };
}

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
    include: { lot: true },
  });

  const payerId = query.from?.id;
  if (
    payerId == null ||
    (order && String(payerId) !== order.buyerId)
  ) {
    await telegramApi("answerPreCheckoutQuery", {
      pre_checkout_query_id: query.id,
      ok: false,
      error_message: "Order unavailable",
    });
    return;
  }

    !order ||
    order.status !== "pending" ||
    order.lot.isSold ||
    order.amount !== totalAmount
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

async function handleSuccessfulPayment(sp, payerTelegramId) {
  const payload = sp.invoice_payload;
  const chargeId = sp.telegram_payment_charge_id;
  const currency = sp.currency;
  const totalAmount = sp.total_amount;

  if (!chargeId || currency !== "XTR") {
    return { handled: false, reason: "invalid_payment_payload" };
  }
  if (payerTelegramId == null) {
    return { handled: false, reason: "missing_payer" };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: payload },
      include: { lot: true },
    });

    if (!order) throw new Error("order_not_found");
    if (String(payerTelegramId) !== order.buyerId) throw new Error("payer_mismatch");
    if (order.status === "paid" || order.status === "completed") return { handled: true };
    if (order.amount !== totalAmount) throw new Error("amount_mismatch");

    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { telegramPaymentChargeId: chargeId },
      });
      if (existing) return;

      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "telegram",
          status: "completed",
          telegramPaymentChargeId: chargeId,
        },
      });

      // Run all order business logic in the same transaction (atomic)
      await _handlePaymentTx(order.id, tx);
    });

    return { handled: true };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { handled: true, duplicate: true };
    }
    return { handled: false, reason: e.message };
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


async function manualConfirmPayment(orderId, userId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) throw new AppError(404, "Order not found");
  if (String(order.buyerId) !== String(userId)) throw new AppError(403, "Access denied");

  // Idempotent: already processed
  if (order.status === "paid" || order.status === "completed") {
    return { handled: true, alreadyPaid: true };
  }
  if (order.status !== "pending") {
    throw new AppError(409, "Order cannot be confirmed");
  }

  await prisma.$transaction(async (tx) => {
    // Create payment record (no chargeId since we don't have it from frontend)
    await tx.payment.create({
      data: {
        orderId,
        provider: "telegram",
        status: "completed",
      },
    });
    // Run all order business logic
    await _handlePaymentTx(orderId, tx);
  });

  return { handled: true };
}

module.exports = {
  createInvoiceLinkForOrder,
  processTelegramUpdate,
  manualConfirmPayment,
};
