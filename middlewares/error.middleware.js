const { AppError } = require("../utils/AppError");

function notFoundHandler(req, res, next) {
  next(new AppError(404, "Not found"));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err instanceof AppError ? err.statusCode : err.statusCode || 500;
  // Always use the real message — internal errors now get wrapped with AppError
  const message = err.message || "Unknown error";

  if (status >= 500) {
    console.error(`[${status}]`, err.message, '\n', err.stack);
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(err instanceof AppError && err.code ? { code: err.code } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
