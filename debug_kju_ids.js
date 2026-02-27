const { initBrowser } = require('./browser_setup');
const { parseProductKJU } = require('./scrapers/kju');

async function debugKjuIds() {
    const { browser, page } = await initBrowser();
    try {
        const targetUrl = 'https://www.kjubrasil.com/acessorios/?ref=7B1313';
        console.log(`Navigating to ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'load' });

        const productSelector = '.produtos .item a, .prod a, a.b_acao';
        await page.waitForSelector(productSelector);

        const urls = await page.evaluate((sel) => {
            const links = Array.from(document.querySelectorAll(sel));
            return [...new Set(links.map(a => a.href))].slice(0, 10);
        }, productSelector);

        console.log(`Found ${urls.length} products. Parsing IDs...`);

        for (const url of urls) {
            console.log(`\nParsing: ${url}`);
            const product = await parseProductKJU(page, url);
            if (product) {
                console.log(`ID: ${product.id} | Name: ${product.nome} | Category: ${product.categoria}`);
            } else {
                console.log(`Failed to parse product at ${url}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debugKjuIds();
