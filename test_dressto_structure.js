// Investigate actual HTML structure
const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const url = 'https://www.dressto.com.br/vestido-cropped-estampa-mares-01342814-2384/p';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const data = await page.evaluate(() => {
        // Investigar todos os tipos de botões/elementos
        const allSizeElements = [];

        // Test multiple selectors
        const selectors = [
            'button[data-sku-id]',
            'button.vtex-button',
            '[class*="skuSelector"]',
            '[class*="sku-selector"]',
            'button[class*="sku"]',
            '.vtex-store-components button'
        ];

        selectors.forEach(sel => {
            const els = document.querySelectorAll(sel);
            console.log(`Selector "${sel}": ${els.length} elements`);
            if (els.length > 0 && els.length < 20) {
                els.forEach((el, i) => {
                    console.log(`  [${i}] Tag: ${el.tagName}, Class: ${el.className.substring(0, 50)}, Text: ${el.textContent.trim().substring(0, 30)}`);
                });
            }
        });

        // Pega qualquer coisa que pareça ser botão de tamanho
        const possibleSizeButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
            const text = btn.textContent.trim().toUpperCase();
            return ['PP', 'P', 'M', 'G', 'GG', 'XG', 'U'].some(size => text.includes(size));
        });

        console.log('\n==== POSSIBLE SIZE BUTTONS ====');
        possibleSizeButtons.forEach((btn, i) => {
            console.log(`[${i}] "${btn.textContent.trim()}" | Class: ${btn.className}`);
        });

        return { found: possibleSizeButtons.length };
    });

    console.log('\nTotal possible buttons:', data.found);

    await browser.close();
}

test().catch(console.error);
