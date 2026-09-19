const app = require("./app");
const env = require("./config/env");
const logger = require("./utils/logger");
const { loadFullCatalog } = require("./services/catalogService");

const db = require("./db");

const PORT = env.PORT || 5000;
const HOST = "0.0.0.0"; // Essential for Render / container deployment

const server = app.listen(PORT, HOST, () => {
    logger.info(`====================================================`);
    logger.info(`INE Product Price Tracker Backend running on http://${HOST}:${PORT}`);
    logger.info(`Health Endpoint: http://${HOST}:${PORT}/api/health`);
    logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    logger.info(`Database: Using Supabase PostgreSQL repository (${db.name})`);
    logger.info(`Supabase URL configured: ${env.SUPABASE_URL ? "YES" : "NO"}`);
    logger.info(`Supabase service role configured: ${env.SUPABASE_SERVICE_ROLE_KEY ? "YES" : "NO"}`);
    logger.info(`====================================================`);

    // Verify database connectivity safely on startup
    if (typeof db.testConnection === "function") {
        db.testConnection().then(res => {
            if (res.ok) {
                logger.info(`[DATABASE] Supabase PostgreSQL connection verified: OK (Table 'tracked_products' accessible)`);
            } else {
                logger.error(`[DATABASE] Supabase PostgreSQL check failed: ${res.error}`);
                if (res.hint) logger.warn(`[DATABASE] Hint: ${res.hint}`);
            }
        }).catch(err => {
            logger.error(`[DATABASE] Connection check error: ${err.message}`);
        });
    }

    // Asynchronously pre-warm mock store product catalog
    loadFullCatalog().catch(err => {
        logger.warn("Initial catalog pre-warm warning:", err.message);
    });
});

// Graceful shutdown
process.on("SIGTERM", () => {
    logger.info("SIGTERM received, closing HTTP server...");
    server.close(() => {
        logger.info("HTTP server closed.");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    logger.info("SIGINT received, closing HTTP server...");
    server.close(() => {
        logger.info("HTTP server closed.");
        process.exit(0);
    });
});

module.exports = server;
