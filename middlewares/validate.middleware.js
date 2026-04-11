const { AppError } = require("../utils/AppError");

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return next(new AppError(400, msg, "validation_error"));
    }
    req.validated = { ...(req.validated || {}), body: parsed.data };
    next();
  };
}

module.exports = { validateBody };
