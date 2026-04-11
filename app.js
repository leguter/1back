const express = require("express");
const cors = require("cors");
const { loadEnv } = require("./config/env");
const { validateBody } = require("./middlewares/validate.middleware");
const { requireAuth } = require("./middlewares/auth.middleware");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");

const authController = require("./controllers/auth.controller");
const productController = require("./controllers/product.controller");
const orderController = require("./controllers/order.controller");
const paymentController = require("./controllers/payment.controller");

loadEnv();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

app.post(
  "/api/auth/telegram",
  validateBody(authController.telegramAuthBodySchema),
  authController.telegramAuth
);

app.get("/api/products", productController.getAll);
app.get("/api/products/:id", productController.getOne);
app.post(
  "/api/products",
  requireAuth,
  validateBody(productController.createProductBodySchema),
  productController.create
);

app.post(
  "/api/orders",
  requireAuth,
  validateBody(orderController.createOrderBodySchema),
  orderController.create
);
app.get("/api/orders/user", requireAuth, orderController.listMine);

app.post(
  "/api/payments/create",
  requireAuth,
  validateBody(paymentController.createPaymentBodySchema),
  paymentController.create
);
app.post("/api/payments/webhook", paymentController.webhook);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
