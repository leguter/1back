const { z } = require("zod");
const { getUserBalance, withdrawBalance } = require("../services/user.service");
const { listTransactions } = require("../services/transaction.service");

const withdrawBodySchema = z.object({
  amount: z.number().int().positive(),
});

async function getBalance(req, res, next) {
  try {
    const balance = await getUserBalance(req.user.sub || req.user.id);
    res.json({ success: true, ...balance });
  } catch (e) {
    next(e);
  }
}

async function getTransactions(req, res, next) {
  try {
    const transactions = await listTransactions(req.user.sub || req.user.id);
    res.json({ success: true, transactions });
  } catch (e) {
    next(e);
  }
}

async function withdraw(req, res, next) {
  try {
    const { amount } = req.validated.body;
    const user = await withdrawBalance(req.user.sub || req.user.id, amount);
    res.json({ success: true, user });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getBalance,
  getTransactions,
  withdraw,
  withdrawBodySchema,
};
