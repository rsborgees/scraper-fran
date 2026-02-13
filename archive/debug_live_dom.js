const { chromium } = require('playwright');

async function debugLive() {
    console.log('--- DEBUGGING LIVE DOM ---');
    const browser = await chromium.launch({ headless: true }); // Headless for speed
    const page = await browser.newPage();

    // URL de um produto que apareceu no teste anterior
    const url = 'https://www.liveoficial.com.br/parka-long-nylon-volt-wax-I408400AM62/p';

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000); // Wait for hydration

        const diagnosis = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));

            return images.map((img, i) => ({
                index: i,
                src: img.src,
                class: img.className,
                parentClass: img.parentElement ? img.parentElement.className : 'null',
                width: img.width,
                height: img.height,
                alt: img.alt
            })).filter(info => info.width > 200 && info.height > 200); // Filter small icons
        });

        console.log('CANDIDATE IMAGES FOUND:', JSON.stringify(diagnosis, null, 2));

        // Check specifically for VTEX common classes
        const vtexCheck = await page.evaluate(() => {
            return {
                storeComponents: document.querySelectorAll('.vtex-store-components-3-x-productImageTag').length,
                renderImages: document.querySelectorAll('.vtex-render-runtime-8-x-lazyload').length
            };
        });
        console.log('VTEX CHECK:', vtexCheck);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

debugLive();
