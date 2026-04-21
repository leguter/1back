const { z } = require("zod");
const { getUserProfile, listLotsByUser, updateUserProfile } = require("../services/user.service");
const { AppError } = require("../utils/AppError");

// user.controller.js
async function getProfile(req, res, next) {
  try {
    const userId = String(req.params.id || req.user.sub || req.user.id);

    if (!userId) {
      return next(new AppError(400, "Invalid User ID"));
    }

    const user = await getUserProfile(userId);
    res.json({ success: true, user });
  } catch (e) {
    next(e);
  }
}

async function getMyLots(req, res, next) {
  try {
    const userId = String(req.params.id || req.user.sub || req.user.id);
    const lots = await listLotsByUser(userId);
    res.json({ success: true, lots });
  } catch (e) {
    next(e);
  }
}

const updateProfileBodySchema = z.object({
  bio:      z.string().max(500).optional(),
  avatar:   z.string().url().max(1000).optional().or(z.literal('')),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores').optional(),
});

async function updateProfile(req, res, next) {
  try {
    const parsed = updateProfileBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return next(new AppError(400, msg, 'validation_error'));
    }
    const userId     = req.params.id;
    const requestorId = req.user.sub || req.user.id;
    const user = await updateUserProfile(userId, requestorId, parsed.data);
    res.json({ success: true, user });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getProfile,
  getMyLots,
  updateProfile,
  updateProfileBodySchema,
};
