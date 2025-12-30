const { initBrowser } = require('./browser_setup');

async function debugKJU() {
    const { browser, page } = await initBrowser();
    const url = 'https://www.kjubrasil.com/bolsa-farm-da-gema-esporte-farm-rainbow-farm-etc-alto-verao-2026/';

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000); // Wait longer for hydration

        const info = await page.evaluate(() => {
            const getSafeText = (el) => el ? (el.innerText || el.textContent || '').trim() : '';
            return {
                h1: getSafeText(document.querySelector('h1')),
                codigo_produto: getSafeText(document.querySelector('.codigo_produto')),
                itemprop_identifier: getSafeText(document.querySelector('[itemprop="identifier"]')),
                meta_sku: document.querySelector('meta[itemprop="sku"]')?.content,
                body_snippet: document.body.innerText.substring(0, 1000)
            };
        });

        console.log('--- DEBUG INFO KJU ---');
        console.log(JSON.stringify(info, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debugKJU();
