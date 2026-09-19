const db = require("../db");
const logger = require("../utils/logger");

const logService = {
    async logAttempt({ tracked_product_id, attempt_number = 1, status, message = "", duration_ms = 0 }) {
        try {
            return await db.insertScrapeLog({
                tracked_product_id,
                attempt_number,
                status,
                message,
                duration_ms
            });
        } catch (error) {
            logger.error(`Error saving scrape log for product ${tracked_product_id}:`, error.message);
            return null;
        }
    },

    async getLogsForProduct(productId, limit = 50) {
        return await db.getScrapeLogs(productId, limit);
    }
};

module.exports = logService;
