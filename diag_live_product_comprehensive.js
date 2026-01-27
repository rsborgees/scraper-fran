const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    try {
        const url = 'https://www.liveoficial.com.br/macaquinho-shorts-fit-green-noir-black-P137800PT01/p';
        console.log(`Navegando para: ${url}`);
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        await page.waitForTimeout(10000);

        const data = await page.evaluate(() => {
            const results = {};

            // 1. All elements with "sku" or "color" in class
            results.skuElements = Array.from(document.querySelectorAll('*'))
                .filter(el => (el.className && typeof el.className === 'string' && (el.className.toLowerCase().includes('sku') || el.className.toLowerCase().includes('color'))))
                .map(el => ({
                    tag: el.tagName,
                    class: el.className,
                    text: (el.innerText || '').substring(0, 50),
                    hasImg: !!el.querySelector('img')
                })).slice(0, 50);

            // 2. All images on page
            results.images = Array.from(document.querySelectorAll('img'))
                .map(img => ({
                    src: img.src.substring(0, 100),
                    alt: img.alt,
                    parentClass: img.parentElement ? img.parentElement.className : '',
                    grandParentClass: (img.parentElement && img.parentElement.parentElement) ? img.parentElement.parentElement.className : ''
                })).slice(0, 50);

            // 3. Precise Price check
            const priceText = (txt) => txt.includes('R$') && txt.match(/\d/);
            results.potentialPrices = Array.from(document.querySelectorAll('span, div, p, strong, b'))
                .filter(el => el.children.length === 0 && priceText(el.innerText || ''))
                .map(el => ({
                    text: el.innerText.trim(),
                    class: el.className,
                    path: (function (e) {
                        let path = [];
                        while (e && e.tagName !== 'BODY') {
                            path.push(e.tagName + (e.className ? '.' + e.className.split(' ').join('.') : ''));
                            e = e.parentElement;
                        }
                        return path.reverse().join(' > ');
                    })(el)
                })).slice(0, 30);

            return results;
        });

        console.log('COMPREHENSIVE DATA:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await browser.close();
    }
})();
