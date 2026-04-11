const { AppError } = require("../utils/AppError");

function notFoundHandler(req, res, next) {
  next(new AppError(404, "Not found"));
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err instanceof AppError ? err.statusCode : err.statusCode || 500;
  const message =
    err instanceof AppError
      ? err.message
      : status === 500
        ? "Internal server error"
        : err.message || "Error";

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(err instanceof AppError && err.code ? { code: err.code } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
