const https = require("https");
const { MOCK_STORE } = require("../config/constants");
const logger = require("../utils/logger");

let catalogCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Deduplicates an array of product items.
 * Prioritizes:
 * 1. Product ID / URL (strongest unique identifiers)
 * 2. SKU (secondary unique identifier)
 * Preserves legitimate products that have different product IDs/URLs.
 * 
 * @param {Array<object>} items - Raw or formatted catalog items
 * @returns {Array<object>} Deduplicated items
 */
function deduplicateProducts(items) {
    if (!Array.isArray(items)) return [];

    const seenIds = new Set();
    const seenUrls = new Set();
    const seenSkus = new Set();
    const unique = [];

    for (const item of items) {
        if (!item || typeof item !== "object") continue;

        const id = item.id !== undefined && item.id !== null ? String(item.id).trim() : null;
        const rawUrl = item.url ? String(item.url).trim().toLowerCase() : (id ? `${MOCK_STORE.BASE_URL}/product/${id}`.toLowerCase() : null);
        const sku = item.sku ? String(item.sku).trim().toUpperCase() : null;

        // Check if seen by ID
        if (id && seenIds.has(id)) {
            continue;
        }

        // Check if seen by URL
        if (rawUrl && seenUrls.has(rawUrl)) {
            continue;
        }

        // Check if seen by SKU
        if (sku && seenSkus.has(sku)) {
            continue;
        }

        // Register keys
        if (id) seenIds.add(id);
        if (rawUrl) seenUrls.add(rawUrl);
        if (sku) seenSkus.add(sku);

        unique.push(item);
    }

    return unique;
}

/**
 * Fetch a single page from the mock store catalog API
 */
function fetchCatalogPage(page = 1, pageSize = 60) {
    return new Promise((resolve, reject) => {
        const url = `${MOCK_STORE.CATALOG_ENDPOINT}?page=${page}&pageSize=${pageSize}`;
        https.get(url, { timeout: 15000 }, res => {
            let body = "";
            res.on("data", chunk => (body += chunk));
            res.on("end", () => {
                try {
                    const data = JSON.parse(body);
                    resolve(data);
                } catch (e) {
                    reject(new Error(`Failed to parse catalog page ${page}: ${e.message}`));
                }
            });
        }).on("error", reject);
    });
}

/**
 * Loads and caches the complete deduplicated catalog from the mock store
 */
async function loadFullCatalog(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && catalogCache && (now - lastCacheTime < CACHE_TTL_MS)) {
        return catalogCache;
    }

    logger.info("Fetching full product catalog from mock store...");
    const firstPage = await fetchCatalogPage(1, 60);
    const totalPages = firstPage.pages || 17;
    let allItems = [...(firstPage.items || [])];

    // Fetch remaining pages in parallel batches
    const pagePromises = [];
    for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(fetchCatalogPage(p, 60));
    }

    const results = await Promise.all(pagePromises);
    for (const res of results) {
        if (res && Array.isArray(res.items)) {
            allItems = allItems.concat(res.items);
        }
    }

    // Deduplicate all products fetched from mock store
    catalogCache = deduplicateProducts(allItems);
    lastCacheTime = now;
    logger.info(`Loaded, deduplicated, and cached ${catalogCache.length} unique products (from ${allItems.length} raw items) from mock store.`);
    return catalogCache;
}

/**
 * Search products by partial or full name, brand, SKU, or category.
 * Guaranteed to return unique products without duplicates.
 */
async function searchProducts(query = "", limit = 30) {
    const trimmed = query.trim().toLowerCase();
    const catalog = await loadFullCatalog();

    if (!trimmed) {
        return catalog.slice(0, limit).map(formatProductItem);
    }

    const matches = catalog.filter(item => {
        const nameMatch = item.name && item.name.toLowerCase().includes(trimmed);
        const brandMatch = item.brand && item.brand.toLowerCase().includes(trimmed);
        const skuMatch = item.sku && item.sku.toLowerCase().includes(trimmed);
        const categoryMatch = item.category && item.category.toLowerCase().includes(trimmed);
        return nameMatch || brandMatch || skuMatch || categoryMatch;
    });

    const uniqueMatches = deduplicateProducts(matches);
    return uniqueMatches.slice(0, limit).map(formatProductItem);
}

/**
 * Format catalog item for consistent API responses
 */
function formatProductItem(item) {
    return {
        id: item.id,
        name: item.name,
        brand: item.brand,
        sku: item.sku,
        category: item.category,
        description: item.description,
        url: item.url || `${MOCK_STORE.BASE_URL}/product/${item.id}`
    };
}

/**
 * Invalidate cache (primarily for tests)
 */
function resetCatalogCache() {
    catalogCache = null;
    lastCacheTime = 0;
}

module.exports = {
    deduplicateProducts,
    loadFullCatalog,
    searchProducts,
    formatProductItem,
    resetCatalogCache
};
