const catalogService = require("../services/catalogService");
const trackingService = require("../services/trackingService");
const priceHistoryService = require("../services/priceHistoryService");
const logService = require("../services/logService");
const { scrapeWithRetry } = require("../scraper/retryHandler");
const logger = require("../utils/logger");

const productController = {
    // GET /api/products/search?q=
    async search(req, res, next) {
        try {
            const query = req.query.q || "";
            const results = await catalogService.searchProducts(query);
            return res.status(200).json({
                success: true,
                count: results.length,
                data: results
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/products/track
    async track(req, res, next) {
        try {
            const { product_name, product_url, product_sku, brand, category, scrape_frequency_minutes, scrape_now } = req.body;

            if (!product_url) {
                return res.status(400).json({
                    success: false,
                    message: "product_url is required"
                });
            }

            const newProduct = await trackingService.trackProduct({
                product_name,
                product_url,
                product_sku,
                brand,
                category,
                scrape_frequency_minutes
            });

            // Perform initial live scrape if requested or by default
            if (scrape_now !== false) {
                // Run scrape asynchronously or inline
                scrapeWithRetry(newProduct.product_url, newProduct.id, logService)
                    .then(async result => {
                        if (result.success && result.data) {
                            await priceHistoryService.recordPriceAndStock(
                                newProduct.id,
                                result.data.price,
                                result.data.stockStatus,
                                result.data.stockQuantity
                            );
                            await trackingService.updateAfterScrape(
                                newProduct.id,
                                true,
                                result.data,
                                newProduct.scrape_frequency_minutes
                            );
                        } else {
                            await trackingService.updateAfterScrape(
                                newProduct.id,
                                false,
                                null,
                                newProduct.scrape_frequency_minutes
                            );
                        }
                    })
                    .catch(err => logger.error("Initial scrape error:", err.message));
            }

            return res.status(201).json({
                success: true,
                message: "Product tracked successfully",
                data: newProduct
            });
        } catch (error) {
            if (error.code === "DUPLICATE") {
                return res.status(409).json({
                    success: false,
                    message: "This product is already being tracked",
                    data: error.existingProduct
                });
            }
            next(error);
        }
    },

    // GET /api/products/tracked
    async getAllTracked(req, res, next) {
        try {
            const products = await trackingService.getAllTrackedProducts();
            return res.status(200).json({
                success: true,
                count: products.length,
                data: products
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/products/:id
    async getById(req, res, next) {
        try {
            const product = await trackingService.getTrackedProductById(req.params.id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Tracked product not found"
                });
            }
            return res.status(200).json({
                success: true,
                data: product
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/products/:id/history
    async getHistory(req, res, next) {
        try {
            const history = await priceHistoryService.getHistoryForProduct(req.params.id);
            return res.status(200).json({
                success: true,
                count: history.length,
                data: history
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/products/:id/logs
    async getLogs(req, res, next) {
        try {
            const logs = await logService.getLogsForProduct(req.params.id);
            return res.status(200).json({
                success: true,
                count: logs.length,
                data: logs
            });
        } catch (error) {
            next(error);
        }
    },

    // PATCH /api/products/:id/frequency
    async updateFrequency(req, res, next) {
        try {
            const { frequency_minutes } = req.body;
            if (!frequency_minutes) {
                return res.status(400).json({
                    success: false,
                    message: "frequency_minutes is required"
                });
            }

            const updated = await trackingService.updateFrequency(req.params.id, frequency_minutes);
            return res.status(200).json({
                success: true,
                message: `Scrape frequency updated to ${frequency_minutes} minutes`,
                data: updated
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/products/:id
    async deleteTracked(req, res, next) {
        try {
            const deleted = await trackingService.deleteTrackedProduct(req.params.id);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found or already removed"
                });
            }
            return res.status(200).json({
                success: true,
                message: "Product tracking stopped and deleted"
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/products/:id/scrape
    async scrapeNow(req, res, next) {
        try {
            const product = await trackingService.getTrackedProductById(req.params.id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Tracked product not found"
                });
            }

            logger.info(`Manual scrape triggered for product ${product.id} (${product.product_name})`);
            const result = await scrapeWithRetry(product.product_url, product.id, logService);

            if (result.success && result.data) {
                const historyResult = await priceHistoryService.recordPriceAndStock(
                    product.id,
                    result.data.price,
                    result.data.stockStatus,
                    result.data.stockQuantity
                );

                const updatedProduct = await trackingService.updateAfterScrape(
                    product.id,
                    true,
                    result.data,
                    product.scrape_frequency_minutes
                );

                return res.status(200).json({
                    success: true,
                    message: "Product scraped successfully",
                    data: {
                        product: updatedProduct,
                        scrape: result.data,
                        priceDrop: historyResult.isPriceDrop,
                        priceDropAmount: historyResult.priceDropAmount,
                        isBackInStock: historyResult.isBackInStock
                    }
                });
            } else {
                await trackingService.updateAfterScrape(
                    product.id,
                    false,
                    null,
                    product.scrape_frequency_minutes
                );

                return res.status(502).json({
                    success: false,
                    message: `Scraping failed: ${result.error}`,
                    status: result.status,
                    attempts: result.attempts
                });
            }
        } catch (error) {
            next(error);
        }
    }
};

module.exports = productController;
