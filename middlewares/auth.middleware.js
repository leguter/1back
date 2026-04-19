const jwt = require("jsonwebtoken");
const { getEnv } = require("../config/env");
const { AppError } = require("../utils/AppError");

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError(401, "Missing or invalid Authorization header");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new AppError(401, "Missing token");
    }
    const { jwtSecret } = getEnv();
    const payload = jwt.verify(token, jwtSecret);
   // у requireAuth
const sub = payload.sub;
if (!sub) {
  throw new AppError(401, "Invalid token payload");
}
req.user = { sub: sub, id: sub }; // Додай і те, і інше для надійності
next();
  } catch (e) {
    if (e instanceof AppError) {
      return next(e);
    }
    if (e.name === "JsonWebTokenError" || e.name === "TokenExpiredError") {
      return next(new AppError(401, "Invalid or expired token"));
    }
    next(e);
  }
}

module.exports = { requireAuth };
