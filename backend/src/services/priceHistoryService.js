const db = require("../db");
const logger = require("../utils/logger");
const { STOCK_STATUS } = require("../config/constants");

const priceHistoryService = {
    /**
     * Records a valid price and stock reading and detects price drops / back-in-stock events
     */
    async recordPriceAndStock(productId, price, stockStatus, stockQuantity = null) {
        if (!price || isNaN(price) || price <= 0) {
            throw new Error(`Cannot record invalid price: ${price}`);
        }

        // Fetch recent price points to detect changes
        const recentPoints = await db.getRecentPriceHistory(productId, 1);
        const previousRecord = recentPoints.length > 0 ? recentPoints[0] : null;

        let priceChange = 0;
        let percentChange = 0;
        let isPriceDrop = false;
        let isBackInStock = false;

        if (previousRecord && previousRecord.price) {
            priceChange = Math.round((price - previousRecord.price) * 100) / 100;
            percentChange = Math.round(((price - previousRecord.price) / previousRecord.price) * 10000) / 100;

            if (price < previousRecord.price) {
                isPriceDrop = true;
                logger.info(`Price drop detected for product ${productId}: Previous=₹${previousRecord.price}, Current=₹${price}, Drop=₹${Math.abs(priceChange)} (${Math.abs(percentChange)}%)`);
            }
        }

        if (previousRecord && previousRecord.stock_status === STOCK_STATUS.OUT_OF_STOCK && stockStatus === STOCK_STATUS.IN_STOCK) {
            isBackInStock = true;
            logger.info(`Back in stock detected for product ${productId}!`);
        }

        const newRecord = await db.insertPriceHistory({
            tracked_product_id: productId,
            price,
            stock_status: stockStatus,
            stock_quantity: stockQuantity,
            scraped_at: new Date().toISOString()
        });

        return {
            record: newRecord,
            isPriceDrop,
            priceDropAmount: isPriceDrop ? Math.abs(priceChange) : 0,
            priceDropPercent: isPriceDrop ? Math.abs(percentChange) : 0,
            isBackInStock
        };
    },

    async getHistoryForProduct(productId, limit = 100) {
        return await db.getPriceHistory(productId, limit);
    }
};

module.exports = priceHistoryService;
