const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const env = require("../config/env");
const logger = require("../utils/logger");

let supabaseClient = null;

function getClient() {
    if (!supabaseClient) {
        if (!env.SUPABASE_URL || (!env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_ANON_KEY)) {
            throw new Error(
                "Supabase credentials missing! Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. " +
                "Execute database/schema.sql in your Supabase SQL Editor to initialize the database."
            );
        }
        const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
        supabaseClient = createClient(env.SUPABASE_URL, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
        logger.info(`Database: Connected to Supabase PostgreSQL at ${env.SUPABASE_URL}`);
    }
    return supabaseClient;
}

function generateId() {
    return crypto.randomUUID();
}

const supabaseRepository = {
    name: "supabase_postgresql",

    isConfigured() {
        return Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY));
    },

    async testConnection() {
        try {
            const client = getClient();
            const { data, error } = await client
                .from("tracked_products")
                .select("id")
                .limit(1);
            if (error) {
                return { ok: false, error: error.message, code: error.code, hint: error.hint };
            }
            return { ok: true, count: data ? data.length : 0 };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    },

    // Tracked Products
    async getAllTrackedProducts() {
        const client = getClient();
        const { data, error } = await client
            .from("tracked_products")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getTrackedProductById(id) {
        const client = getClient();
        const { data, error } = await client
            .from("tracked_products")
            .select("*")
            .eq("id", id)
            .single();
        if (error && error.code !== "PGRST116") throw error;
        return data || null;
    },

    async findTrackedProductByUrl(url) {
        const client = getClient();
        const { data, error } = await client
            .from("tracked_products")
            .select("*")
            .eq("product_url", url)
            .single();
        if (error && error.code !== "PGRST116") throw error;
        return data || null;
    },

    async insertTrackedProduct(product) {
        const client = getClient();
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

        const { data, error } = await client
            .from("tracked_products")
            .insert([record])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateTrackedProduct(id, updates) {
        const client = getClient();
        const now = new Date().toISOString();
        const payload = { ...updates, updated_at: now };

        const { data, error } = await client
            .from("tracked_products")
            .update(payload)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteTrackedProduct(id) {
        const client = getClient();
        const { error } = await client
            .from("tracked_products")
            .delete()
            .eq("id", id);
        if (error) throw error;
        return true;
    },

    async findDueProducts() {
        const client = getClient();
        const now = new Date().toISOString();
        const { data, error } = await client
            .from("tracked_products")
            .select("*")
            .eq("is_active", true)
            .lte("next_scrape_at", now);
        if (error) throw error;
        return data || [];
    },

    // Price History
    async insertPriceHistory(record) {
        const client = getClient();
        const entry = {
            id: record.id || generateId(),
            tracked_product_id: record.tracked_product_id,
            price: record.price,
            stock_status: record.stock_status,
            stock_quantity: record.stock_quantity !== undefined ? record.stock_quantity : null,
            scraped_at: record.scraped_at || new Date().toISOString()
        };

        const { data, error } = await client
            .from("price_history")
            .insert([entry])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getPriceHistory(productId, limit = 100) {
        const client = getClient();
        const { data, error } = await client
            .from("price_history")
            .select("*")
            .eq("tracked_product_id", productId)
            .order("scraped_at", { ascending: true })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    async getRecentPriceHistory(productId, limit = 2) {
        const client = getClient();
        const { data, error } = await client
            .from("price_history")
            .select("*")
            .eq("tracked_product_id", productId)
            .order("scraped_at", { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    // Scrape Logs
    async insertScrapeLog(log) {
        const client = getClient();
        const entry = {
            id: log.id || generateId(),
            tracked_product_id: log.tracked_product_id,
            attempt_number: log.attempt_number || 1,
            status: log.status,
            message: log.message || "",
            duration_ms: log.duration_ms || 0,
            created_at: log.created_at || new Date().toISOString()
        };

        const { data, error } = await client
            .from("scrape_logs")
            .insert([entry])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getScrapeLogs(productId, limit = 100) {
        const client = getClient();
        const { data, error } = await client
            .from("scrape_logs")
            .select("*")
            .eq("tracked_product_id", productId)
            .order("created_at", { ascending: false })
            .order("attempt_number", { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    }
};

module.exports = supabaseRepository;
