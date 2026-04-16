const { z } = require("zod");
const { listLots, getLotById, createLot } = require("../services/lot.service");

const createLotBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().int().positive(),
  category: z.string().min(1).max(100),
});

async function getAll(req, res, next) {
  try {
    const lots = await listLots();
    res.json({ success: true, lots });
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const lot = await getLotById(req.params.id);
    res.json({ success: true, lot });
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const lot = await createLot(req.user.sub, req.validated.body);
    res.status(201).json({ success: true, lot });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getAll,
  getOne,
  create,
  createLotBodySchema,
};
