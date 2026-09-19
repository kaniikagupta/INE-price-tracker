const { chromium } = require("playwright");
const env = require("../config/env");
const logger = require("../utils/logger");
const { parsePrice, parseStock, validateScrapedData } = require("./parser");

/**
 * Ensures cookie overlay is dismissed and cannot intercept pointer events
 */
async function dismissCookieBanner(page) {
    try {
        await page.addStyleTag({
            content: `
                .cookie-overlay, .cookie-banner { display: none !important; pointer-events: none !important; z-index: -99999 !important; }
                body { overflow: auto !important; }
            `
        }).catch(() => {});

        const cookieBtn = page.getByRole("button", { name: /accept cookies|accept/i });
        if (await cookieBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await cookieBtn.click({ force: true }).catch(() => {});
        }
    } catch (e) {}
}

/**
 * Scrapes a single product page from INE's mock store.
 * 
 * @param {string} url - Product URL
 * @param {object} options - Configuration options
 * @returns {Promise<object>} Scraped and validated product data
 */
async function scrapeProductPage(url, options = {}) {
    const isHeadless = options.headless !== undefined ? options.headless : env.SCRAPER_HEADLESS;
    const slowMo = options.slowMo || 0;
    const pageTimeout = options.timeout || env.PAGE_TIMEOUT;
    const failTest = options.failTest || false;

    let browser = null;
    let ownBrowser = false;

    if (options.browser) {
        browser = options.browser;
    } else {
        browser = await chromium.launch({
            headless: isHeadless,
            slowMo: slowMo
        });
        ownBrowser = true;
    }

    const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    });

    try {
        logger.info(`Navigating to ${url} (failTest=${failTest})...`);

        if (failTest) {
            // Intentionally fail for controlled test mode demo
            throw new Error("Controlled test mode: Simulating network timeout or connection reset");
        }

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: pageTimeout
        });

        // 1. Dismiss Cookie Consent Overlay if present
        await dismissCookieBanner(page);

        // 2. Extract Static Product Metadata
        // Category
        let category = "";
        const catLocator = page.locator(".detail-info .tile-category, .tile-category, .category, .breadcrumb").first();
        if (await catLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
            category = (await catLocator.innerText()).trim();
        }

        // Product title / name
        let name = "";
        const titleLocator = page.locator(".detail-info h1, h1, .product-title").first();
        if (await titleLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
            name = (await titleLocator.innerText()).trim();
        }

        // Brand and SKU
        let brand = "";
        let sku = "";
        const metaLocator = page.locator(".detail-info .detail-brand, .detail-brand, .sku, [class*='sku']").first();
        if (await metaLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
            const metaText = await metaLocator.innerText();
            // Format: "Domus · SKU DOM-10039"
            const skuMatch = metaText.match(/SKU\s+([A-Z0-9_-]+)/i);
            if (skuMatch) sku = skuMatch[1].trim();

            const brandPart = metaText.split("·")[0];
            if (brandPart && !brandPart.toLowerCase().includes("sku")) {
                brand = brandPart.trim();
            }
        }

        // 3. Dynamic Price Reveal Interaction
        const priceBlock = page.locator(".price-block, .price-idle, [class*='price-']").first();
        const priceBlockExists = await priceBlock.isVisible({ timeout: 7000 }).catch(() => false);

        if (!priceBlockExists) {
            const error = new Error("Structure changed: Price container (.price-block) not found");
            error.code = "STRUCTURE_CHANGED";
            throw error;
        }

        const revealBtn = page.getByRole("button", { name: /reveal price/i });
        const hasRevealBtn = await revealBtn.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasRevealBtn) {
            logger.info("Reveal button detected. Moving mouse over price block to satisfy dwell verification...");

            // Scroll price block into view
            await priceBlock.scrollIntoViewIfNeeded();

            // Simulate realistic mouse movement across price block to pass anti-bot minMoves/dwellMs check
            const box = await priceBlock.boundingBox();
            if (box) {
                const startX = box.x + 30;
                const startY = box.y + 20;
                for (let i = 0; i < 20; i++) {
                    await page.mouse.move(startX + (i * 15) % Math.max(10, box.width - 60), startY + (i % 4) * 10);
                    await page.waitForTimeout(50);
                }
                // Dwell wait
                await page.waitForTimeout(700);
            }

            // Click the reveal button with retry-until-transition loop to handle store's random drop / throttling
            let transitioned = false;
            for (let c = 1; c <= 5; c++) {
                const text = await priceBlock.innerText().catch(() => "");
                if (text.includes("Loading") || text.includes("Retrying") || text.includes("₹") || text.includes("Rs") || text.includes("in stock") || text.includes("out of stock")) {
                    transitioned = true;
                    break;
                }

                logger.info(`Clicking reveal button (attempt ${c})...`);
                await revealBtn.click({ timeout: 3000 }).catch(() => {});

                // Check for phase change
                for (let w = 0; w < 3; w++) {
                    await page.waitForTimeout(400);
                    const curText = await priceBlock.innerText().catch(() => "");
                    if (curText.includes("Loading") || curText.includes("Retrying") || curText.includes("₹") || curText.includes("Rs") || curText.includes("in stock") || curText.includes("out of stock")) {
                        transitioned = true;
                        break;
                    }
                }
                if (transitioned) break;
            }
        }

        // 4. Wait for Dynamic Price and Stock to render
        // The store page transitions: idle -> loading (spinner) -> success (price-main)
        // If first attempt encounters transient store error (500/503), store auto-retries (Retrying attempt 2/6)
        logger.info("Waiting for price block to resolve...");
        await page.waitForFunction(() => {
            const el = document.querySelector(".price-block");
            if (!el) return false;
            const text = el.innerText || "";
            return text.includes("₹") || text.includes("Rs") || el.classList.contains("price-success") || el.classList.contains("price-error");
        }, { timeout: 25000 });

        // Extra small pause to allow facets (stock) to finalize
        await page.waitForTimeout(500);

        // 5. Extract Visible Selling Price (filtering out decoys, MRPs, discount percentages)
        const rawPriceString = await page.evaluate(() => {
            const priceMain = document.querySelector(".price-main") || document.querySelector(".price-block");
            if (!priceMain) return null;

            const children = Array.from(priceMain.children);
            // Identify the primary price element among direct children of price-main
            const candidate = children.find(c => {
                const s = window.getComputedStyle(c);
                if (s.display === "none" || s.visibility === "hidden" || c.getAttribute("aria-hidden") === "true") return false;
                if (s.textDecoration.includes("line-through")) return false;
                const text = c.textContent.trim();
                if (text.includes("%") || text.toLowerCase().includes("off")) return false;
                if (text.toLowerCase().includes("updating")) return false;
                return text.includes("₹") || text.includes("Rs") || /[0-9]/.test(text);
            });

            if (candidate) {
                return candidate.textContent.trim();
            }

            // Fallback: look for bold tag in price-main
            const bold = priceMain.querySelector("b");
            if (bold && bold.textContent) {
                return bold.textContent.trim();
            }

            return null;
        });

        if (!rawPriceString) {
            const error = new Error("Structure changed: Visible price element not found after reveal");
            error.code = "STRUCTURE_CHANGED";
            throw error;
        }

        const price = parsePrice(rawPriceString);
        if (price === null) {
            throw new Error(`Invalid price value parsed from text: "${rawPriceString}"`);
        }

        // 6. Extract Stock Information
        const rawStockString = await page.evaluate(() => {
            // Check stock badge first
            const badge = document.querySelector(".stock-badge, [class*='stock-badge'], .st-q9, [class*='stock']");
            if (badge && badge.textContent) {
                return badge.textContent.trim();
            }
            // Check facets
            const facets = document.querySelector(".price-facets");
            if (facets && facets.textContent) {
                return facets.textContent.trim();
            }
            // Fallback to body text snippet around stock
            const body = document.body.innerText || "";
            const match = body.match(/(\d+\s+in\s+stock|in\s+stock\s*·?\s*\d*\s*left?|out\s+of\s+stock|currently\s+unavailable|only\s+\d+\s+left|selling\s+fast[^\n]*|hurry[^\n]*)/i);
            return match ? match[0] : null;
        });

        const { stockStatus, stockQuantity } = parseStock(rawStockString);

        const result = {
            name: name || "INE Mock Store Product",
            sku: sku || null,
            brand: brand || null,
            category: category || null,
            price: price,
            stockStatus: stockStatus,
            stockQuantity: stockQuantity,
            url: url
        };

        // 7. Validate Data
        const validation = validateScrapedData(result);
        if (!validation.isValid) {
            throw new Error(`Data validation failed: ${validation.error}`);
        }

        logger.info(`Successfully scraped ${url}: Price=₹${price}, Stock=${stockStatus} (${stockQuantity ?? "N/A"})`);
        return result;

    } finally {
        if (page && !page.isClosed()) {
            await page.close().catch(() => {});
        }
        if (ownBrowser && browser) {
            await browser.close().catch(() => {});
        }
    }
}

module.exports = {
    scrapeProductPage
};
