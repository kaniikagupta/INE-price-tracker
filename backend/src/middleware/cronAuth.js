const env = require("../config/env");
const logger = require("../utils/logger");

/**
 * Middleware to authenticate requests to the external scheduler cron endpoint.
 * Accepts:
 * - Header: 'x-cron-secret'
 * - Header: 'Authorization: Bearer <secret>'
 */
function cronAuth(req, res, next) {
    const providedSecret = 
        req.headers["x-cron-secret"] || 
        (req.headers["authorization"] && req.headers["authorization"].replace(/^Bearer\s+/i, ""));

    if (!providedSecret) {
        logger.warn("Unauthorized cron trigger attempt: Missing cron secret");
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Missing cron secret. Provide 'x-cron-secret' header."
        });
    }

    if (providedSecret !== env.CRON_SECRET) {
        logger.warn("Unauthorized cron trigger attempt: Invalid cron secret provided");
        return res.status(403).json({
            success: false,
            message: "Forbidden: Invalid cron secret."
        });
    }

    next();
}

module.exports = cronAuth;
