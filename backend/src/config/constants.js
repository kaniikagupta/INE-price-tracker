module.exports = {
    DEFAULT_SCRAPE_FREQUENCY_MINUTES: 120, // 2 hours
    ALLOWED_FREQUENCIES_MINUTES: [60, 120, 360, 720, 1440], // 1h, 2h, 6h, 12h, 24h
    MAX_ATTEMPTS: 3,
    PAGE_TIMEOUT_MS: 30000,
    ELEMENT_TIMEOUT_MS: 10000,
    STATUS: {
        SUCCESS: "SUCCESS",
        RETRY: "RETRY",
        FAILED: "FAILED",
        STRUCTURE_CHANGED: "STRUCTURE_CHANGED"
    },
    STOCK_STATUS: {
        IN_STOCK: "IN STOCK",
        OUT_OF_STOCK: "OUT OF STOCK",
        UNKNOWN: "UNKNOWN"
    },
    MOCK_STORE: {
        BASE_URL: "https://demo.inelabteamdev.com",
        CATALOG_ENDPOINT: "https://demo.inelabteamdev.com/api/catalog",
        PRODUCT_ENDPOINT: "https://demo.inelabteamdev.com/api/product"
    }
};
