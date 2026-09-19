const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const logger = require("../utils/logger");

let sqliteDb = null;

function getTestDb() {
    if (!sqliteDb) {
        sqliteDb = new DatabaseSync(":memory:");
        sqliteDb.exec("PRAGMA foreign_keys = ON;");
        initTables(sqliteDb);
        logger.info("Database: Initialized isolated in-memory SQLite test repository");
    }
    return sqliteDb;
}

function initTables(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS tracked_products (
            id TEXT PRIMARY KEY,
            product_name TEXT NOT NULL,
            product_url TEXT NOT NULL UNIQUE,
            product_sku TEXT,
            brand TEXT,
            category TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            scrape_frequency_minutes INTEGER NOT NULL DEFAULT 120,
            last_scraped_at TEXT,
            next_scrape_at TEXT NOT NULL,
            last_price REAL,
            last_stock_status TEXT,
            last_stock_quantity INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS price_history (
            id TEXT PRIMARY KEY,
            tracked_product_id TEXT NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
            price REAL NOT NULL CHECK (price > 0),
            stock_status TEXT NOT NULL,
            stock_quantity INTEGER,
            scraped_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scrape_logs (
            id TEXT PRIMARY KEY,
            tracked_product_id TEXT NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
            attempt_number INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'RETRY', 'FAILED', 'STRUCTURE_CHANGED')),
            message TEXT,
            duration_ms INTEGER,
            created_at TEXT NOT NULL
        );
    `);
}

function generateId() {
    return crypto.randomUUID();
}

const testSqliteRepository = {
    name: "test_sqlite_memory",

    async testConnection() {
        return { ok: true, count: 0 };
    },

    // Tracked Products
    async getAllTrackedProducts() {
        const db = getTestDb();
        const stmt = db.prepare("SELECT * FROM tracked_products ORDER BY created_at DESC");
        const rows = stmt.all();
        return rows.map(r => ({ ...r, is_active: Boolean(r.is_active) }));
    },

    async getTrackedProductById(id) {
        const db = getTestDb();
        const stmt = db.prepare("SELECT * FROM tracked_products WHERE id = ?");
        const row = stmt.get(id);
        if (!row) return null;
        return { ...row, is_active: Boolean(row.is_active) };
    },

    async findTrackedProductByUrl(url) {
        const db = getTestDb();
        const stmt = db.prepare("SELECT * FROM tracked_products WHERE product_url = ?");
        const row = stmt.get(url);
        if (!row) return null;
        return { ...row, is_active: Boolean(row.is_active) };
    },

    async insertTrackedProduct(product) {
        const db = getTestDb();
        const now = new Date().toISOString();
        const record = {
            id: product.id || generateId(),
            product_name: product.product_name,
            product_url: product.product_url,
            product_sku: product.product_sku || null,
            brand: product.brand || null,
            category: product.category || null,
            is_active: product.is_active !== undefined ? product.is_active : true,
            scrape_frequency_minutes: product.scrape_frequency_minutes || 120,
            last_scraped_at: product.last_scraped_at || null,
            next_scrape_at: product.next_scrape_at || now,
            last_price: product.last_price || null,
            last_stock_status: product.last_stock_status || null,
            last_stock_quantity: product.last_stock_quantity !== undefined ? product.last_stock_quantity : null,
            created_at: product.created_at || now,
            updated_at: product.updated_at || now
        };

        const stmt = db.prepare(`
            INSERT INTO tracked_products (
                id, product_name, product_url, product_sku, brand, category,
                is_active, scrape_frequency_minutes, last_scraped_at, next_scrape_at,
                last_price, last_stock_status, last_stock_quantity, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            record.id, record.product_name, record.product_url, record.product_sku,
            record.brand, record.category, record.is_active ? 1 : 0,
            record.scrape_frequency_minutes, record.last_scraped_at, record.next_scrape_at,
            record.last_price, record.last_stock_status, record.last_stock_quantity,
            record.created_at, record.updated_at
        );
        return record;
    },

    async updateTrackedProduct(id, updates) {
        const db = getTestDb();
        const now = new Date().toISOString();
        const payload = { ...updates, updated_at: now };

        const keys = Object.keys(payload).filter(k => payload[k] !== undefined);
        if (keys.length === 0) return this.getTrackedProductById(id);

        const setClause = keys.map(k => `${k} = ?`).join(", ");
        const values = keys.map(k => {
            if (k === "is_active") return payload[k] ? 1 : 0;
            return payload[k] === undefined ? null : payload[k];
        });

        const stmt = db.prepare(`UPDATE tracked_products SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
        return this.getTrackedProductById(id);
    },

    async deleteTrackedProduct(id) {
        const db = getTestDb();
        const stmt = db.prepare("DELETE FROM tracked_products WHERE id = ?");
        const result = stmt.run(id);
        return result.changes > 0;
    },

    async findDueProducts() {
        const db = getTestDb();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            SELECT * FROM tracked_products 
            WHERE is_active = 1 AND next_scrape_at <= ?
            ORDER BY next_scrape_at ASC
        `);
        const rows = stmt.all(now);
        return rows.map(r => ({ ...r, is_active: Boolean(r.is_active) }));
    },

    // Price History
    async insertPriceHistory(record) {
        const db = getTestDb();
        const entry = {
            id: record.id || generateId(),
            tracked_product_id: record.tracked_product_id,
            price: record.price,
            stock_status: record.stock_status,
            stock_quantity: record.stock_quantity !== undefined ? record.stock_quantity : null,
            scraped_at: record.scraped_at || new Date().toISOString()
        };

        const stmt = db.prepare(`
            INSERT INTO price_history (id, tracked_product_id, price, stock_status, stock_quantity, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(entry.id, entry.tracked_product_id, entry.price, entry.stock_status, entry.stock_quantity, entry.scraped_at);
        return entry;
    },

    async getPriceHistory(productId, limit = 100) {
        const db = getTestDb();
        const stmt = db.prepare(`
            SELECT * FROM price_history 
            WHERE tracked_product_id = ? 
            ORDER BY scraped_at ASC 
            LIMIT ?
        `);
        return stmt.all(productId, limit);
    },

    async getRecentPriceHistory(productId, limit = 2) {
        const db = getTestDb();
        const stmt = db.prepare(`
            SELECT * FROM price_history 
            WHERE tracked_product_id = ? 
            ORDER BY scraped_at DESC 
            LIMIT ?
        `);
        return stmt.all(productId, limit);
    },

    // Scrape Logs
    async insertScrapeLog(log) {
        const db = getTestDb();
        const entry = {
            id: log.id || generateId(),
            tracked_product_id: log.tracked_product_id,
            attempt_number: log.attempt_number || 1,
            status: log.status,
            message: log.message || "",
            duration_ms: log.duration_ms || 0,
            created_at: log.created_at || new Date().toISOString()
        };

        const stmt = db.prepare(`
            INSERT INTO scrape_logs (id, tracked_product_id, attempt_number, status, message, duration_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(entry.id, entry.tracked_product_id, entry.attempt_number, entry.status, entry.message, entry.duration_ms, entry.created_at);
        return entry;
    },

    async getScrapeLogs(productId, limit = 100) {
        const db = getTestDb();
        const stmt = db.prepare(`
            SELECT * FROM scrape_logs 
            WHERE tracked_product_id = ? 
            ORDER BY created_at DESC, attempt_number DESC 
            LIMIT ?
        `);
        return stmt.all(productId, limit);
    },

    // Reset database for test isolation
    resetDatabase() {
        if (sqliteDb) {
            sqliteDb.exec("DELETE FROM scrape_logs; DELETE FROM price_history; DELETE FROM tracked_products;");
        }
    }
};

module.exports = testSqliteRepository;
