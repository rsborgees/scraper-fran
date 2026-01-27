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
            const getSafeText = (el) => el ? (el.innerText || '').trim() : '';

            // 1. Encontrar o container de preço principal
            const priceContainer = document.querySelector('.vtex-flex-layout-0-x-flexRowContent--product-main, .vtex-product-price-1-x-priceComponent, .vtex-product-summary-2-x-priceContainer');
            if (priceContainer) {
                results.priceContainerHtml = priceContainer.outerHTML.substring(0, 2000);
            }

            // 2. Encontrar todos os preços na página e suas classes
            results.allPrices = Array.from(document.querySelectorAll('*')).filter(el =>
                el.children.length === 0 && (el.innerText || '').includes('R$')
            ).map(el => ({
                text: el.innerText.trim(),
                class: el.className,
                parentClass: el.parentElement ? el.parentElement.className : ''
            }));

            // 3. Encontrar os seletores de SKU/Cores
            const skuSelectors = document.querySelector('.vtex-flex-layout-0-x-flexRowContent--product-main .vtex-sku-selector-1-x-container, .skuSelectorContainer');
            if (skuSelectors) {
                results.skuSelectorsHtml = skuSelectors.outerHTML.substring(0, 2000);
            }

            // 4. Detalhes dos thumbnails de cor
            results.colorThumbs = Array.from(document.querySelectorAll('li, div')).filter(el =>
                el.querySelector('img') && (el.className.includes('sku') || el.className.includes('color'))
            ).map(el => ({
                className: el.className,
                html: el.innerHTML.substring(0, 300)
            }));

            return results;
        });

        console.log('DETAILED DATA:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await browser.close();
    }
})();
