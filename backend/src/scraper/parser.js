const { STOCK_STATUS } = require("../config/constants");

/**
 * Normalizes and extracts numeric price from raw text.
 * Handles:
 * - Currency symbols: ₹, Rs., INR, $
 * - Trailing info: "/- (incl. of all taxes)"
 * - Full-width unicode digits: ０-９ (\uFF10-\uFF19)
 * - European formatting: "12.079,00"
 * - Spaced formatting: "12 079"
 * - Indian formatting: "21,470" or "1,299"
 * - Decimal prices: "99.50"
 * 
 * Rejects:
 * - Empty or non-string
 * - Negative or zero
 * - NaN or unparseable
 */
function parsePrice(raw) {
    if (!raw || typeof raw !== "string") return null;

    // Normalize Unicode NFKC
    let s = raw.normalize("NFKC");

    // Remove zero-width characters
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");

    // Convert fullwidth digits (0-9)
    s = s.replace(/[\uFF10-\uFF19]/g, d => String.fromCharCode(d.charCodeAt(0) - 65248));

    // Check if raw contains prefix like "Deal price ₹13,125", "Special price: ₹...", "Price: ₹..."
    // Extract everything from the currency symbol or first digit onwards
    const currencyMatch = s.match(/(?:₹|Rs\.?|INR|\$)\s*([0-9\s,\.\uFF10-\uFF19]+)/i);
    if (currencyMatch) {
        s = currencyMatch[1];
    } else {
        // Fallback: remove leading non-digits and currency indicators
        s = s.replace(/^[^\d₹$RsINR]+/i, "");
        s = s.replace(/₹|Rs\.?|INR|\$|\/.*|\(.*?\)/gi, "").trim();
    }

    // Check for negative signs
    if (s.includes("-")) return null;

    // Remove regular spaces and non-breaking spaces
    s = s.replace(/[\s\u00A0]+/g, "");

    // Check for European decimal notation (e.g. "12.079,00")
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
        s = s.replace(/\./g, "").replace(",", ".");
    } else {
        // Standard comma as thousands separator (e.g. "21,470" or "21,470.50")
        s = s.replace(/,/g, "");
    }

    const val = parseFloat(s);
    if (isNaN(val) || val <= 0 || !isFinite(val)) return null;

    // Return rounded to 2 decimals
    return Math.round(val * 100) / 100;
}

/**
 * Extracts stock status and numeric quantity from raw stock text.
 */
function parseStock(raw) {
    if (!raw || typeof raw !== "string") {
        return { stockStatus: STOCK_STATUS.UNKNOWN, stockQuantity: null };
    }

    const normalized = raw.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    const upper = normalized.toUpperCase();

    // Check Out of Stock variants
    if (
        upper.includes("OUT OF STOCK") ||
        upper.includes("CURRENTLY UNAVAILABLE") ||
        upper.includes("SOLD OUT") ||
        upper.includes("UNAVAILABLE")
    ) {
        return { stockStatus: STOCK_STATUS.OUT_OF_STOCK, stockQuantity: 0 };
    }

    // Check In Stock / Left variants
    if (upper.includes("IN STOCK") || upper.includes("LEFT") || upper.includes("AVAILABLE")) {
        // Look for number before "IN STOCK", "LEFT", "REMAINING", etc.
        const match = upper.match(/(\d+)\s*(?:IN STOCK|LEFT|REMAINING|UNITS)/) ||
                      upper.match(/(?:ONLY|JUST)?\s*(\d+)\s*(?:LEFT|IN STOCK)?/);

        const qty = match && match[1] ? parseInt(match[1], 10) : null;
        return {
            stockStatus: STOCK_STATUS.IN_STOCK,
            stockQuantity: qty !== null && !isNaN(qty) && qty >= 0 ? qty : null
        };
    }

    return { stockStatus: STOCK_STATUS.UNKNOWN, stockQuantity: null };
}

/**
 * Validates extracted product data.
 * Guarantees zero bad or fake data enters the database.
 */
function validateScrapedData(data) {
    if (!data || typeof data !== "object") {
        return { isValid: false, error: "Scraped data is null or not an object" };
    }

    if (typeof data.price !== "number" || isNaN(data.price) || data.price <= 0) {
        return { isValid: false, error: `Invalid price extracted: ${data.price}` };
    }

    if (!data.stockStatus || (data.stockStatus !== STOCK_STATUS.IN_STOCK && data.stockStatus !== STOCK_STATUS.OUT_OF_STOCK)) {
        return { isValid: false, error: `Invalid stock status extracted: ${data.stockStatus}` };
    }

    if (data.stockQuantity !== null && (typeof data.stockQuantity !== "number" || isNaN(data.stockQuantity) || data.stockQuantity < 0)) {
        return { isValid: false, error: `Invalid stock quantity: ${data.stockQuantity}` };
    }

    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
        return { isValid: false, error: "Product name is missing or empty" };
    }

    return { isValid: true };
}

module.exports = {
    parsePrice,
    parseStock,
    validateScrapedData
};
