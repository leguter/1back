const { z } = require("zod");
const { getUserBalance, withdrawBalance, getWithdrawEligibility } = require("../services/user.service");
const { listTransactions } = require("../services/transaction.service");

const withdrawBodySchema = z.object({
  amount: z.number().int().positive(),
  mode:   z.enum(["fast", "free"]).optional(),
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

async function getEligibility(req, res, next) {
  try {
    const eligibility = await getWithdrawEligibility(req.user.sub || req.user.id);
    res.json({ success: true, ...eligibility });
  } catch (e) {
    next(e);
  }
}

async function withdraw(req, res, next) {
  try {
    const { amount, mode } = req.validated.body;
    const result = await withdrawBalance(req.user.sub || req.user.id, amount, mode);
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getBalance,
  getTransactions,
  getEligibility,
  withdraw,
  withdrawBodySchema,
};
