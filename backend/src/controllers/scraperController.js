const trackingService = require("../services/trackingService");
const priceHistoryService = require("../services/priceHistoryService");
const logService = require("../services/logService");
const { scrapeWithRetry } = require("../scraper/retryHandler");
const logger = require("../utils/logger");

const scraperController = {
    // POST /api/scraper/run
    async runScheduledScrape(req, res, next) {
        const startTime = Date.now();
        logger.info("External cron triggered: Finding products due for scraping...");

        try {
            const dueProducts = await trackingService.getDueProducts();

            if (!dueProducts || dueProducts.length === 0) {
                logger.info("No tracked products currently due for scraping.");
                return res.status(200).json({
                    success: true,
                    message: "No products currently due for scraping",
                    processedCount: 0,
                    results: [],
                    durationMs: Date.now() - startTime
                });
            }

            logger.info(`Found ${dueProducts.length} product(s) due for scraping.`);
            const results = [];

            // Process each due product sequentially with full fault isolation
            for (const product of dueProducts) {
                logger.info(`Scheduler processing product ${product.id} (${product.product_name})...`);
                try {
                    const scrapeResult = await scrapeWithRetry(product.product_url, product.id, logService);

                    if (scrapeResult.success && scrapeResult.data) {
                        const historyResult = await priceHistoryService.recordPriceAndStock(
                            product.id,
                            scrapeResult.data.price,
                            scrapeResult.data.stockStatus,
                            scrapeResult.data.stockQuantity
                        );

                        await trackingService.updateAfterScrape(
                            product.id,
                            true,
                            scrapeResult.data,
                            product.scrape_frequency_minutes
                        );

                        results.push({
                            productId: product.id,
                            name: product.product_name,
                            status: "SUCCESS",
                            price: scrapeResult.data.price,
                            stock: scrapeResult.data.stockStatus,
                            priceDrop: historyResult.isPriceDrop,
                            isBackInStock: historyResult.isBackInStock
                        });
                    } else {
                        await trackingService.updateAfterScrape(
                            product.id,
                            false,
                            null,
                            product.scrape_frequency_minutes
                        );

                        results.push({
                            productId: product.id,
                            name: product.product_name,
                            status: scrapeResult.status || "FAILED",
                            error: scrapeResult.error
                        });
                    }
                } catch (productErr) {
                    // Critical guarantee: Error on one product MUST NOT stop other products
                    logger.error(`Unhandled error scraping product ${product.id}:`, productErr.message);
                    results.push({
                        productId: product.id,
                        name: product.product_name,
                        status: "ERROR",
                        error: productErr.message
                    });
                }
            }

            const successCount = results.filter(r => r.status === "SUCCESS").length;
            const failureCount = results.length - successCount;

            logger.info(`Scheduled scrape cycle complete: ${successCount} succeeded, ${failureCount} failed out of ${results.length}.`);

            return res.status(200).json({
                success: true,
                message: `Processed ${results.length} due product(s): ${successCount} succeeded, ${failureCount} failed`,
                processedCount: results.length,
                successCount,
                failureCount,
                durationMs: Date.now() - startTime,
                results
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = scraperController;
