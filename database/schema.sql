-- ============================================================
-- INE Product Price Tracker - Supabase PostgreSQL Schema
-- ============================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Table: tracked_products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name TEXT NOT NULL,
    product_url TEXT NOT NULL UNIQUE,
    product_sku TEXT,
    brand TEXT,
    category TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    scrape_frequency_minutes INTEGER NOT NULL DEFAULT 120,
    last_scraped_at TIMESTAMPTZ,
    next_scrape_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_price NUMERIC(12, 2),
    last_stock_status TEXT,
    last_stock_quantity INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for scheduler queries (find due active products)
CREATE INDEX IF NOT EXISTS idx_tracked_products_due 
ON tracked_products (is_active, next_scrape_at);

-- Index for SKU lookup
CREATE INDEX IF NOT EXISTS idx_tracked_products_sku 
ON tracked_products (product_sku);

-- ------------------------------------------------------------
-- Table: price_history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracked_product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    stock_status TEXT NOT NULL,
    stock_quantity INTEGER,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying history chronologically per product
CREATE INDEX IF NOT EXISTS idx_price_history_product_time 
ON price_history (tracked_product_id, scraped_at DESC);

-- ------------------------------------------------------------
-- Table: scrape_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracked_product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'RETRY', 'FAILED', 'STRUCTURE_CHANGED')),
    message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying logs chronologically per product
CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_time 
ON scrape_logs (tracked_product_id, created_at DESC);

-- Trigger for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tracked_products_updated_at ON tracked_products;
CREATE TRIGGER set_tracked_products_updated_at
BEFORE UPDATE ON tracked_products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- Permissions & Table Grants for Backend Service Role
-- ------------------------------------------------------------
GRANT ALL ON TABLE tracked_products TO service_role;
GRANT ALL ON TABLE price_history TO service_role;
GRANT ALL ON TABLE scrape_logs TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- ------------------------------------------------------------
-- Row Level Security (RLS) Configuration
-- Keeps RLS enabled for database security compliance
-- ------------------------------------------------------------
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access Policies
DROP POLICY IF EXISTS "service_role_manage_tracked_products" ON tracked_products;
CREATE POLICY "service_role_manage_tracked_products"
ON tracked_products FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_price_history" ON price_history;
CREATE POLICY "service_role_manage_price_history"
ON price_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_scrape_logs" ON scrape_logs;
CREATE POLICY "service_role_manage_scrape_logs"
ON scrape_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

