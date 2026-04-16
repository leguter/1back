const express = require("express");
const cors = require("cors");
const { loadEnv } = require("./config/env");
const { validateBody } = require("./middlewares/validate.middleware");
const { requireAuth } = require("./middlewares/auth.middleware");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");

const authController = require("./controllers/auth.controller");
const lotController = require("./controllers/lot.controller");
const orderController = require("./controllers/order.controller");
const paymentController = require("./controllers/payment.controller");
const chatController = require("./controllers/chat.controller");
const userController = require("./controllers/user.controller");
const balanceController = require("./controllers/balance.controller");

loadEnv();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

// Auth
app.post(
  "/api/auth/telegram",
  validateBody(authController.telegramAuthBodySchema),
  authController.telegramAuth
);

// Lots (replaced Products)
app.get("/api/lots", lotController.getAll);
app.get("/api/lots/:id", lotController.getOne);
app.post(
  "/api/lots",
  requireAuth,
  validateBody(lotController.createLotBodySchema),
  lotController.create
);

// Orders
app.post(
  "/api/orders",
  requireAuth,
  validateBody(orderController.createOrderBodySchema),
  orderController.create
);
app.get("/api/orders", requireAuth, orderController.listMine);
app.get("/api/orders/:id", requireAuth, orderController.getOne);
app.patch("/api/orders/:id/confirm", requireAuth, orderController.confirm);

// Payments
app.post(
  "/api/payments/create",
  requireAuth,
  validateBody(paymentController.createPaymentBodySchema),
  paymentController.create
);
app.post("/api/payments/webhook", paymentController.webhook);

// Chat
app.get("/api/chat/:orderId", requireAuth, chatController.getOrderMessages);
app.post(
  "/api/chat/:orderId",
  requireAuth,
  validateBody(chatController.sendMessageBodySchema),
  chatController.sendOrderMessage
);

// Balance & Transactions
app.get("/api/balance", requireAuth, balanceController.getBalance);
app.get("/api/transactions", requireAuth, balanceController.getTransactions);
app.post(
  "/api/withdraw",
  requireAuth,
  validateBody(balanceController.withdrawBodySchema),
  balanceController.withdraw
);

// User Profile
app.get("/api/users/:id", userController.getProfile);
app.get("/api/users/:id/lots", userController.getMyLots);
app.get("/api/profile", requireAuth, userController.getProfile);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
