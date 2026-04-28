require("dotenv").config();

const REQUIRED = ["DATABASE_URL", "TELEGRAM_BOT_TOKEN", "JWT_SECRET"];

let cached;

function loadEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  cached = {
    databaseUrl: process.env.DATABASE_URL,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    jwtSecret: process.env.JWT_SECRET,
    baseUrl: (process.env.BASE_URL ?? "").replace(/\/$/, ""),
    nodeEnv: process.env.NODE_ENV || "development",
    telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  };
  return cached;
}

function getEnv() {
  if (!cached) loadEnv();
  return cached;
}

module.exports = { getEnv, loadEnv };
