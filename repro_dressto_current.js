const { initBrowser } = require('./browser_setup');
const { parseProductDressTo } = require('./scrapers/dressto/parser');
const path = require('path');

async function testDressToListing() {
    console.log('--- Testing Dress To Listing ---');
    const { browser, page } = await initBrowser();

    // Set cookie
    await page.context().addCookies([
        {
            name: 'vtex_segment',
            value: 'eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9',
            domain: '.dressto.com.br',
            path: '/'
        }
    ]);

    try {
        const url = 'https://www.dressto.com.br/nossas-novidades?page=1&sc=1';
        console.log(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        const title = await page.title();
        console.log(`Page Title: ${title}`);

        if (title.includes('Render Server - Error')) {
            console.log('DETECTED RENDER SERVER ERROR');
        }

        const productUrls = await page.evaluate(() => {
            const sel = 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"], a[href*="/p?"]';
            const links = Array.from(document.querySelectorAll(sel));
            return [...new Set(links.map(a => a.href))]
                .filter(u => u.includes('/p'));
        });

        console.log(`Found ${productUrls.length} product URLs in DOM.`);
        productUrls.slice(0, 5).forEach(u => console.log(` - ${u}`));

        if (productUrls.length === 0) {
            console.log('Trying API fallback...');
            const apiUrl = `https://www.dressto.com.br/api/catalog_system/pub/products/search?sc=1&_from=0&_to=19`;
            const resp = await page.context().request.get(apiUrl, {
                headers: {
                    'Cookie': 'vtex_segment=eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9'
                }
            });
            if (resp.ok()) {
                const json = await resp.json();
                console.log(`API returned ${json.length} products.`);
                if (json.length > 0) {
                    const firstProduct = json[0];
                    const productUrl = firstProduct.link.startsWith('http') ? firstProduct.link : `https://www.dressto.com.br${firstProduct.link.startsWith('/') ? '' : '/'}${firstProduct.link}`;
                    console.log(`\nTesting parser on API-found URL: ${productUrl}`);
                    const product = await parseProductDressTo(page, productUrl);
                    console.log('Parsed result:', JSON.stringify(product, null, 2));
                }
            } else {
                console.log(`API failed with status: ${resp.status()}`);
            }
        } else {
            // Test parsing one product
            console.log(`\nTesting parser on: ${productUrls[0]}`);
            const product = await parseProductDressTo(page, productUrls[0]);
            console.log('Parsed result:', JSON.stringify(product, null, 2));
        }

    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        await browser.close();
    }
}

testDressToListing();
