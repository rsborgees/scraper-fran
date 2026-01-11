const { initBrowser } = require('../../browser_setup');

async function getBazarSample() {
    console.log('🚀 Getting Bazar Sample...');
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.farmrio.com.br/bazar', { waitUntil: 'domcontentloaded' });

        // Wait for some products to load
        await page.waitForTimeout(5000);

        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors
                .map(a => a.href)
                .filter(href => href.includes('/p?') || href.includes('/p/') || href.endsWith('/p'))
                .slice(0, 3);
        });

        console.log('🔗 Sample Bazar Links:');
        links.forEach(l => console.log(l));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

getBazarSample();
