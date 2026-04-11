const { z } = require("zod");
const { authenticateTelegram } = require("../services/auth.service");

const telegramAuthBodySchema = z.object({
  initData: z.string().min(1, "initData is required"),
});

async function telegramAuth(req, res, next) {
  try {
    const { initData } = req.validated.body;
    const result = await authenticateTelegram(initData);
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

module.exports = { telegramAuth, telegramAuthBodySchema };
