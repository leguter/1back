const { getUserProfile, listLotsByUser } = require("../services/user.service");

// user.controller.js
async function getProfile(req, res, next) {
  try {
    const rawId = req.params.id || req.user.sub || req.user.id;
    const userId = Number(rawId); // Перетворюємо на число ОБОВ'ЯЗКОВО

    if (isNaN(userId)) {
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
    const userId = req.params.id || req.user.sub || req.user.id;
    const lots = await listLotsByUser(userId);
    res.json({ success: true, lots });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getProfile,
  getMyLots,
};
