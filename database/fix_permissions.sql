-- ============================================================
-- Fix Permissions and Configure RLS for Supabase Service Role
-- Run this in your Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Grant full table permissions to service_role
GRANT ALL ON TABLE public.tracked_products TO service_role;
GRANT ALL ON TABLE public.price_history TO service_role;
GRANT ALL ON TABLE public.scrape_logs TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- 2. Keep Row Level Security (RLS) ENABLED for security compliance
ALTER TABLE public.tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;

-- 3. Add explicit RLS policies for service_role
DROP POLICY IF EXISTS "service_role_manage_tracked_products" ON public.tracked_products;
CREATE POLICY "service_role_manage_tracked_products"
ON public.tracked_products FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_price_history" ON price_history;
CREATE POLICY "service_role_manage_price_history"
ON public.price_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_manage_scrape_logs" ON scrape_logs;
CREATE POLICY "service_role_manage_scrape_logs"
ON public.scrape_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
