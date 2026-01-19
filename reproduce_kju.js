const { initBrowser } = require('./browser_setup');
const { parseProductKJU } = require('./scrapers/kju/index');

async function run() {
    const { browser, page } = await initBrowser();
    try {
        console.log('Navigating to KJU Accessories...');
        await page.goto('https://www.kjubrasil.com/acessorios/', { waitUntil: 'domcontentloaded' });

        // Find a product link
        const productUrl = await page.evaluate(() => {
            const el = document.querySelector('.produtos .item a, .prod a, a.b_acao');
            return el ? el.href : null;
        });

        if (!productUrl) {
            console.error('No product found on listing page.');
            return;
        }


        console.log(`Testing with Product URL: ${productUrl}`);


        console.log('Inspecting price hierarchy...');
        await page.evaluate(() => {
            const valorEl = document.querySelector('.valor');
            if (valorEl) {
                console.log('Found .valor');
                let parent = valorEl.parentElement;
                while (parent) {
                    console.log(`Parent: ${parent.tagName.toLowerCase()}.${parent.className.replace(/\s+/g, '.')}`);
                    parent = parent.parentElement;
                }
            } else {
                console.log('.valor NOT FOUND in document');
            }

            const detalhes = document.querySelector('.detalhes');
            if (detalhes) console.log('Found .detalhes');
            else console.log('.detalhes NOT FOUND');
        });


        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

        // Run parser
        const product = await parseProductKJU(page, productUrl);
        console.log('Final Result:', JSON.stringify(product, null, 2));


    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

run();
