const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    try {
        const url = 'https://www.liveoficial.com.br/macaquinho-shorts-fit-green-noir-black-P137800PT01/p';
        console.log(`Navegando para: ${url}`);
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        await page.waitForTimeout(8000);

        const data = await page.evaluate(() => {
            const results = {};

            // Meta Tags
            results.metaTags = Array.from(document.querySelectorAll('meta')).map(m => ({
                name: m.getAttribute('name') || m.getAttribute('property'),
                content: m.getAttribute('content')
            })).filter(m => m.name && (m.name.includes('price') || m.name.includes('amount') || m.name.includes('sku')));

            // JSON-LD
            results.jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
                try {
                    return JSON.parse(s.innerHTML);
                } catch (e) {
                    return { error: "Parse error" };
                }
            });

            return results;
        });

        console.log('META DATA:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await browser.close();
    }
})();
