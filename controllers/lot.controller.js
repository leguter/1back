const { z } = require('zod');
const { listLots, getLotById, createLot, updateLot, deleteLot } = require('../services/lot.service');

const createLotBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().int().positive(),
  category: z.string().min(1).max(100),
  subscribersCount: z.number().int().positive().optional().nullable(),
  stockCount: z.number().int().min(1).max(100).default(1),
});

const updateLotBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().int().positive(),
  category: z.string().min(1).max(100),
  subscribersCount: z.number().int().positive().optional().nullable(),
  stockCount: z.number().int().min(1).max(100).optional(),
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
    const lot = await createLot(req.user.sub || req.user.id, req.validated.body);
    res.status(201).json({ success: true, lot });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    const lot = await updateLot(req.params.id, userId, req.validated.body);
    res.json({ success: true, lot });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const userId = req.user.sub || req.user.id;
    await deleteLot(req.params.id, userId);
    res.json({ success: true, deleted: true });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getAll,
  getOne,
  create,
  update,
  remove,
  createLotBodySchema,
  updateLotBodySchema,
};
