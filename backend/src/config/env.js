const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const constants = require("./constants");

const env = {
    PORT: parseInt(process.env.PORT || "5000", 10),
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    CRON_SECRET: process.env.CRON_SECRET || "ine_cron_secret_default_2026",
    SCRAPER_HEADLESS: process.env.SCRAPER_HEADLESS !== "false",
    MAX_ATTEMPTS: parseInt(process.env.MAX_ATTEMPTS || String(constants.MAX_ATTEMPTS), 10),
    PAGE_TIMEOUT: parseInt(process.env.PAGE_TIMEOUT || String(constants.PAGE_TIMEOUT_MS), 10),
    ELEMENT_TIMEOUT: parseInt(process.env.ELEMENT_TIMEOUT || String(constants.ELEMENT_TIMEOUT_MS), 10),
    DEFAULT_SCRAPE_FREQUENCY_MINUTES: parseInt(process.env.DEFAULT_SCRAPE_FREQUENCY_MINUTES || String(constants.DEFAULT_SCRAPE_FREQUENCY_MINUTES), 10)
};

module.exports = env;
