const jwt = require("jsonwebtoken");
const { getEnv } = require("../config/env");
const { parseAndVerifyInitData } = require("../utils/telegramInitData");
const { prisma } = require("../utils/prisma");
const { AppError } = require("../utils/AppError");

async function authenticateTelegram(initData) {
  const { telegramBotToken, jwtSecret } = getEnv();
  const result = parseAndVerifyInitData(initData, telegramBotToken);
  if (!result.ok) {
    console.warn("Telegram initData rejected:", result.error);
    throw new AppError(403, "Invalid or expired Telegram initData", "invalid_telegram_data");
  }

  const { id, username, first_name } = result.user;

  const user = await prisma.user.upsert({
    where: { id },
    create: {
      id,
      username: username ?? null,
      firstName: first_name,
    },
    update: {
      username: username ?? null,
      firstName: first_name,
    },
  });

  const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "7d" });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
    },
  };
}

module.exports = { authenticateTelegram };
