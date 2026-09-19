const db = require("../db");
const logger = require("../utils/logger");
const { DEFAULT_SCRAPE_FREQUENCY_MINUTES, ALLOWED_FREQUENCIES_MINUTES } = require("../config/constants");

const trackingService = {
    async trackProduct({ product_name, product_url, product_sku, brand, category, scrape_frequency_minutes }) {
        if (!product_url) {
            throw new Error("Product URL is required");
        }

        // Duplicate check
        const existing = await db.findTrackedProductByUrl(product_url);
        if (existing) {
            const err = new Error("Product is already being tracked");
            err.code = "DUPLICATE";
            err.existingProduct = existing;
            throw err;
        }

        const frequency = parseInt(scrape_frequency_minutes, 10) || DEFAULT_SCRAPE_FREQUENCY_MINUTES;
        const now = new Date().toISOString();

        const newProduct = await db.insertTrackedProduct({
            product_name: product_name || "Unknown Product",
            product_url,
            product_sku: product_sku || null,
            brand: brand || null,
            category: category || null,
            is_active: true,
            scrape_frequency_minutes: frequency,
            last_scraped_at: null,
            next_scrape_at: now // immediately eligible for initial scrape
        });

        logger.info(`Tracked new product: ${newProduct.product_name} (${newProduct.id})`);
        return newProduct;
    },

    async getAllTrackedProducts() {
        const products = await db.getAllTrackedProducts();

        // Augment with price change and drop status
        const augmented = await Promise.all(products.map(async p => {
            const history = await db.getRecentPriceHistory(p.id, 2);
            let priceChange = 0;
            let priceChangePercent = 0;
            let isPriceDrop = false;
            let isBackInStock = false;

            if (history.length >= 2) {
                const latest = history[0];
                const previous = history[1];
                if (latest.price && previous.price) {
                    priceChange = Math.round((latest.price - previous.price) * 100) / 100;
                    priceChangePercent = Math.round(((latest.price - previous.price) / previous.price) * 10000) / 100;
                    if (latest.price < previous.price) {
                        isPriceDrop = true;
                    }
                }
                if (previous.stock_status === "OUT OF STOCK" && latest.stock_status === "IN STOCK") {
                    isBackInStock = true;
                }
            }

            return {
                ...p,
                price_change: priceChange,
                price_change_percent: priceChangePercent,
                is_price_drop: isPriceDrop,
                price_drop_amount: isPriceDrop ? Math.abs(priceChange) : 0,
                is_back_in_stock: isBackInStock
            };
        }));

        return augmented;
    },

    async getTrackedProductById(id) {
        return await db.getTrackedProductById(id);
    },

    async updateFrequency(id, minutes) {
        const freq = parseInt(minutes, 10);
        if (!ALLOWED_FREQUENCIES_MINUTES.includes(freq)) {
            throw new Error(`Invalid frequency. Allowed values: ${ALLOWED_FREQUENCIES_MINUTES.join(", ")} minutes`);
        }

        const product = await db.getTrackedProductById(id);
        if (!product) {
            throw new Error("Tracked product not found");
        }

        const nextScrape = new Date(Date.now() + freq * 60 * 1000).toISOString();
        const updated = await db.updateTrackedProduct(id, {
            scrape_frequency_minutes: freq,
            next_scrape_at: nextScrape
        });

        logger.info(`Updated frequency for product ${id} to ${freq} minutes`);
        return updated;
    },

    async deleteTrackedProduct(id) {
        return await db.deleteTrackedProduct(id);
    },

    async updateAfterScrape(id, scrapeSuccess, scrapedData = null, frequencyMinutes = 120) {
        const now = new Date();
        const nextDate = new Date(now.getTime() + (frequencyMinutes || 120) * 60 * 1000);

        if (scrapeSuccess && scrapedData) {
            const updates = {
                last_scraped_at: now.toISOString(),
                next_scrape_at: nextDate.toISOString(),
                last_price: scrapedData.price,
                last_stock_status: scrapedData.stockStatus,
                last_stock_quantity: scrapedData.stockQuantity !== undefined ? scrapedData.stockQuantity : null
            };
            if (scrapedData.name) updates.product_name = scrapedData.name;
            if (scrapedData.sku) updates.product_sku = scrapedData.sku;
            if (scrapedData.brand) updates.brand = scrapedData.brand;
            if (scrapedData.category) updates.category = scrapedData.category;

            return await db.updateTrackedProduct(id, updates);
        } else {
            // Failed scrape: preserve previous valid price/stock, set next retry to 30 mins
            const retryDate = new Date(now.getTime() + 30 * 60 * 1000);
            return await db.updateTrackedProduct(id, {
                last_scraped_at: now.toISOString(),
                next_scrape_at: retryDate.toISOString()
            });
        }
    },

    async getDueProducts() {
        return await db.findDueProducts();
    }
};

module.exports = trackingService;
