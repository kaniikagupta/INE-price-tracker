const logger = require("../utils/logger");

function errorHandler(err, req, res, next) {
    logger.error("Unhandled API Error:", err.stack || err.message);

    const statusCode = err.statusCode || (err.code === "DUPLICATE" ? 409 : 500);
    res.status(statusCode).json({
        success: false,
        message: err.message || "An internal server error occurred",
        ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {})
    });
}

module.exports = errorHandler;
