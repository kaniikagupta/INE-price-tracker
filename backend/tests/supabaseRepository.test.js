const { describe, test } = require("node:test");
const assert = require("node:assert");

describe("12. Supabase PostgreSQL Repository Implementation", () => {
    test("supabaseRepository defines all required interface methods", () => {
        const supabaseRepo = require("../src/db/supabaseRepository");
        assert.strictEqual(supabaseRepo.name, "supabase_postgresql");
        assert.strictEqual(typeof supabaseRepo.getAllTrackedProducts, "function");
        assert.strictEqual(typeof supabaseRepo.getTrackedProductById, "function");
        assert.strictEqual(typeof supabaseRepo.findTrackedProductByUrl, "function");
        assert.strictEqual(typeof supabaseRepo.insertTrackedProduct, "function");
        assert.strictEqual(typeof supabaseRepo.updateTrackedProduct, "function");
        assert.strictEqual(typeof supabaseRepo.deleteTrackedProduct, "function");
        assert.strictEqual(typeof supabaseRepo.findDueProducts, "function");
        assert.strictEqual(typeof supabaseRepo.insertPriceHistory, "function");
        assert.strictEqual(typeof supabaseRepo.getPriceHistory, "function");
        assert.strictEqual(typeof supabaseRepo.getRecentPriceHistory, "function");
        assert.strictEqual(typeof supabaseRepo.insertScrapeLog, "function");
        assert.strictEqual(typeof supabaseRepo.getScrapeLogs, "function");
    });

    test("supabaseRepository reports configured status correctly", () => {
        const supabaseRepo = require("../src/db/supabaseRepository");
        // isConfigured returns boolean
        assert.strictEqual(typeof supabaseRepo.isConfigured(), "boolean");
    });
});
