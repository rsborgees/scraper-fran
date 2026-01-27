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

            // 1. Precise Price Logic
            const mainInfo = document.querySelector('.vtex-flex-layout-0-x-flexRowContent--product-main') ||
                Array.from(document.querySelectorAll('div')).find(div => (div.innerText || '').includes('Cor:'));

            if (mainInfo) {
                const prices = Array.from(mainInfo.querySelectorAll('span, div, b, strong')).filter(el => {
                    const txt = (el.innerText || '').trim();
                    return txt.includes('R$') && /\d/.test(txt) && !/\d\s*x|x\s*de|parcela|juros/i.test(txt) && txt.length < 30;
                }).map(el => {
                    const val = parseFloat((el.innerText || '').replace(/[^\d,]/g, '').replace(',', '.'));
                    return { val, class: el.className, text: el.innerText };
                }).filter(p => !isNaN(p.val) && p.val > 20);

                results.mainInfoPrices = prices;
                if (prices.length > 0) {
                    // Filter prices that are likely selling prices (not crossed out)
                    // In Live, the selling price has sc-79aad9d-3 or similar.
                    // Let's just pick the highest as original and lowest as current if multiple.
                    const unique = [...new Set(prices.map(p => p.val))].sort((a, b) => a - b);
                    results.identifiedPrice = unique[0];
                    results.identifiedPriceOriginal = unique.length > 1 ? unique[unique.length - 1] : unique[0];
                }
            }

            // 2. Color Selection Logic
            const allElements = Array.from(document.querySelectorAll('span, div, b, strong'));
            const colorLabel = allElements.find(el => (el.innerText || '').includes('Cor:'));
            if (colorLabel) {
                let current = colorLabel;
                let colorContainer = null;
                // Search upwards for a container that has siblings with images
                for (let i = 0; i < 5; i++) {
                    if (!current) break;
                    if (current.querySelectorAll('img').length > 0) {
                        colorContainer = current;
                        // But wait, the label itself might be in the container.
                    }
                    current = current.parentElement;
                }

                // Better: find images that are close to the color label
                const allImgs = Array.from(document.querySelectorAll('img'));
                const thumbs = allImgs.filter(img => {
                    const box = img.getBoundingClientRect();
                    return box.width > 20 && box.width < 100 && box.height > 20 && box.height < 100;
                }).map(img => ({
                    alt: img.alt,
                    src: img.src.substring(0, 50),
                    class: img.parentElement ? img.parentElement.className : ''
                }));
                results.potentialThumbs = thumbs.slice(0, 10);
            }

            return results;
        });

        console.log('SANDBOX RESULTS:', JSON.stringify(data, null, 2));
    } finally {
        await browser.close();
    }
})();
