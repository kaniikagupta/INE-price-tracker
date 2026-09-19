const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");

// Ensure test environment uses SQLite in-memory and predictable secrets
process.env.NODE_ENV = "test";
process.env.PORT = "5099";
process.env.CRON_SECRET = "test_cron_secret_ine_123";
process.env.SCRAPER_HEADLESS = "true";

const app = require("../src/app");
const { parsePrice, parseStock, validateScrapedData } = require("../src/scraper/parser");
const priceHistoryService = require("../src/services/priceHistoryService");
const trackingService = require("../src/services/trackingService");
const logService = require("../src/services/logService");
const catalogService = require("../src/services/catalogService");
const { scrapeWithRetry } = require("../src/scraper/retryHandler");
const db = require("../src/db");

let server;
const BASE_URL = "http://127.0.0.1:5099";

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: {
                "Content-Type": "application/json",
                ...headers
            }
        };

        const req = http.request(url, options, res => {
            let data = "";
            res.on("data", chunk => (data += chunk));
            res.on("end", () => {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({ status: res.statusCode, data: parsed, headers: res.headers });
            });
        });

        req.on("error", reject);
        if (body) {
            req.write(typeof body === "string" ? body : JSON.stringify(body));
        }
        req.end();
    });
}

before(done => {
    server = app.listen(5099, "127.0.0.1", done);
});

after(done => {
    server.close(done);
});

describe("1. Health Endpoint", () => {
    test("GET /api/health should return status 200 and OK", async () => {
        const res = await request("GET", "/api/health");
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.status, "OK");
        assert.ok(res.data.database);
    });
});

describe("2. Price Parsing & Normalization", () => {
    test("parses standard Indian currency format (₹21,470)", () => {
        assert.strictEqual(parsePrice("₹21,470"), 21470);
        assert.strictEqual(parsePrice("₹1,299"), 1299);
    });

    test("parses decimal prices (₹99.50)", () => {
        assert.strictEqual(parsePrice("₹99.50"), 99.5);
    });

    test("parses European formatted prices (₹12.079,00)", () => {
        assert.strictEqual(parsePrice("₹12.079,00"), 12079);
    });

    test("parses spaced digits (₹ 12 079)", () => {
        assert.strictEqual(parsePrice("₹ 12 079"), 12079);
    });

    test("parses trailing tax info (₹21,470/- (incl. of all taxes))", () => {
        assert.strictEqual(parsePrice("₹21,470/- (incl. of all taxes)"), 21470);
    });

    test("parses fullwidth Unicode digits (₹２１，４７０)", () => {
        assert.strictEqual(parsePrice("₹２１，４７０"), 21470);
    });
});

describe("3. Invalid Price Rejection", () => {
    test("rejects negative numbers", () => {
        assert.strictEqual(parsePrice("₹-50"), null);
    });

    test("rejects zero", () => {
        assert.strictEqual(parsePrice("₹0"), null);
    });

    test("rejects non-numeric garbage or empty strings", () => {
        assert.strictEqual(parsePrice("Price not available"), null);
        assert.strictEqual(parsePrice(""), null);
        assert.strictEqual(parsePrice(null), null);
    });

    test("validateScrapedData rejects missing or invalid price", () => {
        const res1 = validateScrapedData({ price: -10, stockStatus: "IN STOCK", name: "Test" });
        assert.strictEqual(res1.isValid, false);

        const res2 = validateScrapedData({ price: NaN, stockStatus: "IN STOCK", name: "Test" });
        assert.strictEqual(res2.isValid, false);

        const res3 = validateScrapedData({ price: 0, stockStatus: "IN STOCK", name: "Test" });
        assert.strictEqual(res3.isValid, false);
    });
});

describe("4. Stock Status & Quantity Parsing", () => {
    test("parses '62 in stock'", () => {
        const s = parseStock("62 in stock");
        assert.strictEqual(s.stockStatus, "IN STOCK");
        assert.strictEqual(s.stockQuantity, 62);
    });

    test("parses 'IN STOCK · 50 LEFT'", () => {
        const s = parseStock("IN STOCK · 50 LEFT");
        assert.strictEqual(s.stockStatus, "IN STOCK");
        assert.strictEqual(s.stockQuantity, 50);
    });

    test("parses 'Only 4 left in stock'", () => {
        const s = parseStock("Only 4 left in stock");
        assert.strictEqual(s.stockStatus, "IN STOCK");
        assert.strictEqual(s.stockQuantity, 4);
    });

    test("parses 'OUT OF STOCK'", () => {
        const s = parseStock("OUT OF STOCK");
        assert.strictEqual(s.stockStatus, "OUT OF STOCK");
        assert.strictEqual(s.stockQuantity, 0);
    });

    test("parses 'Currently unavailable'", () => {
        const s = parseStock("Currently unavailable");
        assert.strictEqual(s.stockStatus, "OUT OF STOCK");
        assert.strictEqual(s.stockQuantity, 0);
    });
});

describe("5. Product Catalog Search & Deduplication", () => {
    test("deduplicateProducts removes duplicate product URL", () => {
        const items = [
            { id: 1, name: "Product A", url: "https://demo.inelabteamdev.com/product/1", sku: "SKU-1" },
            { id: 2, name: "Product A Duplicate", url: "https://demo.inelabteamdev.com/product/1", sku: "SKU-2" }
        ];
        const unique = catalogService.deduplicateProducts(items);
        assert.strictEqual(unique.length, 1);
        assert.strictEqual(unique[0].id, 1);
    });

    test("deduplicateProducts removes duplicate product ID", () => {
        const items = [
            { id: 101, name: "Product 101", sku: "SKU-A" },
            { id: 101, name: "Product 101 Duplicate", sku: "SKU-B" }
        ];
        const unique = catalogService.deduplicateProducts(items);
        assert.strictEqual(unique.length, 1);
        assert.strictEqual(unique[0].name, "Product 101");
    });

    test("deduplicateProducts removes duplicate SKU", () => {
        const items = [
            { id: 201, name: "Product X", sku: "COB-10001" },
            { id: 202, name: "Product X Duplicate SKU", sku: "COB-10001" }
        ];
        const unique = catalogService.deduplicateProducts(items);
        assert.strictEqual(unique.length, 1);
        assert.strictEqual(unique[0].id, 201);
    });

    test("deduplicateProducts preserves legitimate unique products with different IDs/URLs", () => {
        const items = [
            { id: 1, name: "Larkspur Trackpad Mini", sku: "LAR-10115", url: "https://demo.inelabteamdev.com/product/1" },
            { id: 2, name: "Cobalt Trackpad Pro", sku: "COB-10035", url: "https://demo.inelabteamdev.com/product/2" },
            { id: 3, name: "Copperpot Trackpad X", sku: "COP-10755", url: "https://demo.inelabteamdev.com/product/3" }
        ];
        const unique = catalogService.deduplicateProducts(items);
        assert.strictEqual(unique.length, 3);
    });

    test("partial search finds products by substring ('tab')", async () => {
        const results = await catalogService.searchProducts("tab", 10);
        assert.ok(results.length > 0);
        assert.ok(results.some(r => r.name.toLowerCase().includes("tab") || r.category.toLowerCase().includes("tab")));
    });

    test("full search finds products by exact full name", async () => {
        const catalog = await catalogService.loadFullCatalog();
        assert.ok(catalog.length > 0);
        const target = catalog[0];
        const results = await catalogService.searchProducts(target.name, 10);
        assert.ok(results.length > 0);
        assert.ok(results.some(r => r.name.toLowerCase() === target.name.toLowerCase()));
    });

    test("case-insensitive search returns identical results regardless of casing", async () => {
        const lower = await catalogService.searchProducts("trackpad", 30);
        const upper = await catalogService.searchProducts("TRACKPAD", 30);
        const mixed = await catalogService.searchProducts("TrAcKpAd", 30);
        assert.strictEqual(lower.length, upper.length);
        assert.strictEqual(lower.length, mixed.length);
    });

    test("GET /api/products/search?q=trackpad returns strictly unique products without duplicates", async () => {
        const res = await request("GET", "/api/products/search?q=trackpad");
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert.ok(Array.isArray(res.data.data));
        assert.ok(res.data.data.length > 0);

        const seenIds = new Set();
        const seenUrls = new Set();
        for (const item of res.data.data) {
            assert.strictEqual(seenIds.has(item.id), false, `Duplicate ID detected: ${item.id}`);
            assert.strictEqual(seenUrls.has(item.url), false, `Duplicate URL detected: ${item.url}`);
            seenIds.add(item.id);
            seenUrls.add(item.url);
        }
    });

    test("GET /api/products/search?q=Cobalt finds exact or specific brand products", async () => {
        const res = await request("GET", "/api/products/search?q=Cobalt");
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert.ok(res.data.data.some(p => p.brand.toLowerCase().includes("cobalt") || p.name.toLowerCase().includes("cobalt")));
    });
});

describe("6. Track Product & Duplicate Prevention", () => {
    let createdId;
    const testUrl = "https://demo.inelabteamdev.com/product/999999";

    test("POST /api/products/track creates tracked product", async () => {
        const res = await request("POST", "/api/products/track", {
            product_name: "Test Mechanical Keyboard",
            product_url: testUrl,
            product_sku: "TST-999999",
            brand: "TestBrand",
            category: "Peripherals",
            scrape_now: false
        });

        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.data.product_name, "Test Mechanical Keyboard");
        assert.strictEqual(res.data.data.scrape_frequency_minutes, 120); // Default 2h
        createdId = res.data.data.id;
    });

    test("POST /api/products/track rejects duplicate tracking of same URL", async () => {
        const res = await request("POST", "/api/products/track", {
            product_name: "Duplicate Keyboard",
            product_url: testUrl,
            scrape_now: false
        });

        assert.strictEqual(res.status, 409);
        assert.strictEqual(res.data.success, false);
        assert.match(res.data.message, /already being tracked/i);
    });

    test("DELETE /api/products/:id removes tracked product", async () => {
        const res = await request("DELETE", `/api/products/${createdId}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
    });
});

describe("7. Price History & Bonus Event Detection", () => {
    let prod;

    before(async () => {
        prod = await trackingService.trackProduct({
            product_name: "Price Drop Monitor Test",
            product_url: "https://demo.inelabteamdev.com/product/888888",
            scrape_frequency_minutes: 120
        });
    });

    after(async () => {
        await trackingService.deleteTrackedProduct(prod.id);
    });

    test("records initial price and stock without false price drop", async () => {
        const r1 = await priceHistoryService.recordPriceAndStock(prod.id, 25000, "OUT OF STOCK", 0);
        assert.strictEqual(r1.isPriceDrop, false);
        assert.strictEqual(r1.isBackInStock, false);
    });

    test("Bonus 2: detects price drop when price decreases", async () => {
        const r2 = await priceHistoryService.recordPriceAndStock(prod.id, 21470, "OUT OF STOCK", 0);
        assert.strictEqual(r2.isPriceDrop, true);
        assert.strictEqual(r2.priceDropAmount, 3530);
    });

    test("Bonus 3: detects back-in-stock when stock transitions from OUT OF STOCK to IN STOCK", async () => {
        const r3 = await priceHistoryService.recordPriceAndStock(prod.id, 21470, "IN STOCK", 50);
        assert.strictEqual(r3.isBackInStock, true);
    });

    test("GET /api/products/:id/history returns chronological history points", async () => {
        const res = await request("GET", `/api/products/${prod.id}/history`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.count, 3);
        assert.strictEqual(res.data.data[0].price, 25000);
        assert.strictEqual(res.data.data[1].price, 21470);
    });
});

describe("8. Scrape Log Recording & Retrieval", () => {
    let prod;

    before(async () => {
        prod = await trackingService.trackProduct({
            product_name: "Logging Test Product",
            product_url: "https://demo.inelabteamdev.com/product/777777"
        });
    });

    after(async () => {
        await trackingService.deleteTrackedProduct(prod.id);
    });

    test("records RETRY and SUCCESS scrape logs honestly", async () => {
        await logService.logAttempt({
            tracked_product_id: prod.id,
            attempt_number: 1,
            status: "RETRY",
            message: "Navigation timeout, retrying",
            duration_ms: 3000
        });

        await logService.logAttempt({
            tracked_product_id: prod.id,
            attempt_number: 2,
            status: "SUCCESS",
            message: "Extracted price ₹15000",
            duration_ms: 2500
        });

        const res = await request("GET", `/api/products/${prod.id}/logs`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.count, 2);
        assert.strictEqual(res.data.data[0].status, "SUCCESS");
        assert.strictEqual(res.data.data[1].status, "RETRY");
    });
});

describe("9. Retry Behavior & Failure Protection", () => {
    test("retry handler executes up to MAX_ATTEMPTS with backoff and stops", async () => {
        const mockLog = { attempts: [], logAttempt: async e => mockLog.attempts.push(e) };
        const result = await scrapeWithRetry("https://invalid-non-existent-domain.xyz/prod", "dummy-id", mockLog, {
            maxAttempts: 2,
            timeout: 500
        });

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.status, "FAILED");
        assert.strictEqual(mockLog.attempts.length, 2);
        assert.strictEqual(mockLog.attempts[0].status, "RETRY");
        assert.strictEqual(mockLog.attempts[1].status, "FAILED");
    });

    test("updateAfterScrape preserves valid price data when a scrape fails", async () => {
        const prod = await trackingService.trackProduct({
            product_name: "Preserve Data Test",
            product_url: "https://demo.inelabteamdev.com/product/666666"
        });

        try {
            // Set initial valid price
            await trackingService.updateAfterScrape(prod.id, true, {
                price: 5000,
                stockStatus: "IN STOCK",
                stockQuantity: 10
            }, 120);

            const beforeFailure = await trackingService.getTrackedProductById(prod.id);
            assert.strictEqual(beforeFailure.last_price, 5000);

            // Simulate failed scrape
            await trackingService.updateAfterScrape(prod.id, false, null, 120);

            const afterFailure = await trackingService.getTrackedProductById(prod.id);
            // Price and stock MUST NOT be erased or set to null/fake values
            assert.strictEqual(afterFailure.last_price, 5000);
            assert.strictEqual(afterFailure.last_stock_status, "IN STOCK");
        } finally {
            await trackingService.deleteTrackedProduct(prod.id);
        }
    });
});

describe("10. Cron Scheduler Security & Fault Isolation", () => {
    test("POST /api/scraper/run rejects missing x-cron-secret", async () => {
        const res = await request("POST", "/api/scraper/run", {});
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.data.success, false);
    });

    test("POST /api/scraper/run rejects invalid x-cron-secret", async () => {
        const res = await request("POST", "/api/scraper/run", {}, { "x-cron-secret": "wrong_secret" });
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.data.success, false);
    });

    test("POST /api/scraper/run accepts valid x-cron-secret", async () => {
        const res = await request("POST", "/api/scraper/run", {}, { "x-cron-secret": "test_cron_secret_ine_123" });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert.ok(typeof res.data.processedCount === "number");
    });
});

describe("11. Bonus 5: Configurable Scrape Frequency", () => {
    let prod;

    before(async () => {
        prod = await trackingService.trackProduct({
            product_name: "Frequency Test Product",
            product_url: "https://demo.inelabteamdev.com/product/555555",
            scrape_frequency_minutes: 120
        });
    });

    after(async () => {
        await trackingService.deleteTrackedProduct(prod.id);
    });

    test("PATCH /api/products/:id/frequency updates to allowed frequency (60 mins)", async () => {
        const res = await request("PATCH", `/api/products/${prod.id}/frequency`, {
            frequency_minutes: 60
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.data.scrape_frequency_minutes, 60);
    });

    test("PATCH /api/products/:id/frequency rejects invalid frequency (45 mins)", async () => {
        const res = await request("PATCH", `/api/products/${prod.id}/frequency`, {
            frequency_minutes: 45
        });
        assert.strictEqual(res.status, 500); // Handled error with invalid frequency message
        assert.strictEqual(res.data.success, false);
    });
});
