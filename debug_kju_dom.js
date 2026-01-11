
const { initBrowser } = require('./browser_setup');
const path = require('path');
const fs = require('fs');

(async () => {
    const url = "https://www.kjubrasil.com/bolsinha-farm-me-leva-urbano-beija-flor-farm-etc-alto-verao-2026/";
    console.log(`🔍 Inspecting KJU URL: ${url}`);

    const { browser, page } = await initBrowser();

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Screenshot
        const debugDir = path.join(__dirname, 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const screenshotPath = path.join(debugDir, 'kju_debug.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);

        // Extract DOM details
        const details = await page.evaluate(() => {
            const getSafeText = (el) => (el.innerText || el.textContent || '').trim();
            const elements = Array.from(document.querySelectorAll('.price, .current-price, .old-price, .preco, span, strong, b, div[class*="price"]'));

            return elements
                .filter(el => getSafeText(el).includes('R$'))
                .map(el => ({
                    tag: el.tagName,
                    class: el.className,
                    text: getSafeText(el),
                    width: el.offsetWidth,
                    height: el.offsetHeight,
                    visible: window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden'
                }));
        });

        console.log("\n--- DOM Price Elements Found ---");
        details.forEach((d, i) => {
            console.log(`[${i}] <${d.tag} class="${d.class}"> | Visible: ${d.visible} | Text: "${d.text}"`);
        });
        console.log("--------------------------------\n");

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await browser.close();
    }
})();
