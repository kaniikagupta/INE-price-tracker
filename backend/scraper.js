const { chromium } = require("playwright");

const PRODUCT_URL = "https://demo.inelabteamdev.com/product/39";

async function scrapeProduct(url) {
    const browser = await chromium.launch({
        headless: false
    });

    const page = await browser.newPage();

    try {
        console.log("Opening product page...");

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000
        });

        console.log("Page opened.");

        // Give dynamic content some time to appear
        await page.waitForTimeout(1000);

        // Find the button used to reveal the live price
        const revealButton = page.getByRole("button", {
            name: /reveal price/i
        });

        if (await revealButton.count() > 0) {
            console.log("Reveal Price button found.");

            await revealButton.click();

            console.log("Reveal Price clicked.");
        } else {
            console.log("Reveal Price button not found.");
        }

        // Wait for the dynamic price/stock information
        await page.waitForTimeout(3000);

        const bodyText = await page.locator("body").innerText();

        console.log("\n========== PAGE TEXT ==========\n");
        console.log(bodyText);
        console.log("\n================================\n");

    } catch (error) {
        console.error("\nSCRAPE FAILED:");
        console.error(error.message);
    }
}

scrapeProduct(PRODUCT_URL);