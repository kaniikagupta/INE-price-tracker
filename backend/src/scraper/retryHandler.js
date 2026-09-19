const env = require("../config/env");
const logger = require("../utils/logger");
const { STATUS } = require("../config/constants");
const { scrapeProductPage } = require("./playwrightScraper");

/**
 * Executes scraping with exponential backoff and honest attempt logging.
 * 
 * @param {string} url - Product URL to scrape
 * @param {string} productId - Tracked product ID in database
 * @param {object} logService - Service to persist attempt logs
 * @param {object} options - Optional config overrides (e.g. headless, browser, failTest)
 * @returns {Promise<{ success: boolean, data?: object, error?: string, status: string }>}
 */
async function scrapeWithRetry(url, productId, logService, options = {}) {
    const maxAttempts = options.maxAttempts || env.MAX_ATTEMPTS;
    let lastError = null;
    let isStructureChanged = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const startTime = Date.now();
        logger.info(`Scraping product ${productId} (attempt ${attempt}/${maxAttempts})...`);

        try {
            const data = await scrapeProductPage(url, options);
            const durationMs = Date.now() - startTime;

            // Log successful attempt
            if (logService && productId) {
                await logService.logAttempt({
                    tracked_product_id: productId,
                    attempt_number: attempt,
                    status: STATUS.SUCCESS,
                    message: `Price and stock successfully extracted: ₹${data.price} (${data.stockStatus})`,
                    duration_ms: durationMs
                }).catch(err => logger.error("Failed to log success attempt:", err.message));
            }

            return {
                success: true,
                data: data,
                status: STATUS.SUCCESS,
                attempts: attempt
            };

        } catch (error) {
            const durationMs = Date.now() - startTime;
            lastError = error;

            if (error.code === "STRUCTURE_CHANGED" || error.message.toLowerCase().includes("structure changed")) {
                isStructureChanged = true;
            }

            const isLastAttempt = attempt === maxAttempts;
            const logStatus = isStructureChanged 
                ? STATUS.STRUCTURE_CHANGED 
                : (isLastAttempt ? STATUS.FAILED : STATUS.RETRY);

            const logMessage = isLastAttempt 
                ? `Scraping failed after ${attempt} attempts: ${error.message}` 
                : `Attempt ${attempt} failed, retrying: ${error.message}`;

            logger.warn(`[${logStatus}] Product ${productId} attempt ${attempt}: ${error.message}`);

            if (logService && productId) {
                await logService.logAttempt({
                    tracked_product_id: productId,
                    attempt_number: attempt,
                    status: logStatus,
                    message: logMessage,
                    duration_ms: durationMs
                }).catch(err => logger.error("Failed to log retry/failure attempt:", err.message));
            }

            // Exponential backoff wait before next attempt: 1s, 2s, 4s...
            if (!isLastAttempt) {
                const backoffMs = Math.pow(2, attempt - 1) * 1000;
                logger.info(`Waiting ${backoffMs}ms before attempt ${attempt + 1}...`);
                await new Promise(res => setTimeout(res, backoffMs));
            }
        }
    }

    return {
        success: false,
        error: lastError ? lastError.message : "All scraping attempts exhausted",
        status: isStructureChanged ? STATUS.STRUCTURE_CHANGED : STATUS.FAILED,
        attempts: maxAttempts
    };
}

module.exports = {
    scrapeWithRetry
};
