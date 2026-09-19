#!/usr/bin/env node
/**
 * Headed Scraper Demonstration Script
 * 
 * Visibly opens Chromium, interacts with the mock store page,
 * performs mouse movement dwell to enable REVEAL PRICE,
 * extracts dynamic price and stock, and prints colored results.
 * 
 * Supports:
 *   node scripts/headed-scrape.js [url_or_product_id] [--fail-test] [--slowmo 500]
 */

const { scrapeProductPage } = require("../src/scraper/playwrightScraper");
const { scrapeWithRetry } = require("../src/scraper/retryHandler");
const logger = require("../src/utils/logger");

const args = process.argv.slice(2);
const isFailTest = args.includes("--fail-test");
const slowMoArg = args.find(a => a.startsWith("--slowmo="));
const slowMo = slowMoArg ? parseInt(slowMoArg.split("=")[1], 10) : 100;

// URL parameter or default product
let targetUrl = "https://demo.inelabteamdev.com/product/39";
for (const arg of args) {
    if (arg.startsWith("http")) {
        targetUrl = arg;
        break;
    } else if (/^\d+$/.test(arg)) {
        targetUrl = `https://demo.inelabteamdev.com/product/${arg}`;
        break;
    }
}

console.log("\n========================================================");
console.log("       INE PRODUCT PRICE TRACKER — HEADED SCRAPER       ");
console.log("========================================================");
console.log(` Target URL : ${targetUrl}`);
console.log(` Mode       : HEADED (Visible Chromium Window)`);
console.log(` SlowMo     : ${slowMo}ms`);
console.log(` Test Mode  : ${isFailTest ? "INTENTIONAL FAILURE / RETRY DEMO" : "NORMAL LIVE SCRAPE"}`);
console.log("========================================================\n");

// Dummy log collector for CLI demonstration
const mockLogService = {
    async logAttempt(entry) {
        console.log(`\n>>> [ATTEMPT LOG #${entry.attempt_number}] Status: ${entry.status}`);
        console.log(`    Message: ${entry.message}`);
        console.log(`    Duration: ${entry.duration_ms}ms\n`);
    }
};

(async () => {
    try {
        console.log("Launching visible Chromium browser...\n");

        const result = await scrapeWithRetry(targetUrl, "headed-demo-prod", mockLogService, {
            headless: false,
            slowMo: slowMo,
            failTest: isFailTest,
            maxAttempts: 3
        });

        console.log("\n========================================================");
        console.log("                     SCRAPE RESULTS                     ");
        console.log("========================================================");

        if (result.success && result.data) {
            console.log("  Status        : SUCCESS");
            console.log(`  Product Name  : ${result.data.name}`);
            console.log(`  Brand         : ${result.data.brand || "N/A"}`);
            console.log(`  SKU           : ${result.data.sku || "N/A"}`);
            console.log(`  Category      : ${result.data.category || "N/A"}`);
            console.log(`  Live Price    : ₹${result.data.price}`);
            console.log(`  Stock Status  : ${result.data.stockStatus}`);
            console.log(`  Stock Quantity: ${result.data.stockQuantity !== null ? result.data.stockQuantity : "Not specified"}`);
            console.log(`  URL           : ${result.data.url}`);
            console.log(`  Total Attempts: ${result.attempts}`);
        } else {
            console.log(`  Status        : ${result.status}`);
            console.log(`  Error Message : ${result.error}`);
            console.log(`  Total Attempts: ${result.attempts}`);
            console.log("  Notice        : No invalid data was saved.");
        }

        console.log("========================================================\n");

        if (isFailTest) {
            console.log("Note: The failure above was intentionally triggered via --fail-test");
            console.log("to demonstrate exponential backoff retries and honest failure logging.");
        }

        process.exit(result.success ? 0 : 1);

    } catch (err) {
        console.error("\n[FATAL ERROR]:", err.message);
        process.exit(1);
    }
})();
