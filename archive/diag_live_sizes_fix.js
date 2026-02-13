const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    try {
        const url = 'https://www.liveoficial.com.br/macaquinho-shorts-fit-green-noir-black-P137800PT01/p';
        console.log(`Navegando para: ${url}`);
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        await page.waitForTimeout(8000);

        const data = await page.evaluate(async () => {
            const results = {};

            // 1. Inspect Prices in Main Container
            const mainContainer = document.querySelector('.vtex-flex-layout-0-x-flexRowContent--product-main, .vtex-product-summary-2-x-priceContainer, main');
            if (mainContainer) {
                results.mainContainerHtml = mainContainer.outerHTML.substring(0, 3000);
                results.pricesInMain = Array.from(mainContainer.querySelectorAll('*')).filter(el =>
                    el.children.length === 0 && (el.innerText || '').includes('R$')
                ).map(el => ({
                    text: el.innerText.trim(),
                    tag: el.tagName,
                    class: el.className,
                    parentClass: el.parentElement.className
                }));
            }

            // 2. Click "Preto" and Check Sizes
            // We need to find the "Preto" thumbnail. 
            // In the previous run, we found it via img[src*="/color/"]
            const colorThumbs = Array.from(document.querySelectorAll('img[src*="/color/"]'));
            const pretoThumb = colorThumbs.find(img => (img.alt || '').toLowerCase().includes('preto'));

            if (pretoThumb) {
                pretoThumb.click();
                // Wait a bit for the DOM to update (simulating waitForTimeout)
                await new Promise(r => setTimeout(r, 3000));

                // Now inspect sizes
                const sizeEls = Array.from(document.querySelectorAll('[class*="sku-selector"], [class*="size"], [class*="tamanho"], button, li, label'));
                results.sizesAfterClickPreto = sizeEls.filter(el => {
                    const txt = (el.innerText || '').trim();
                    return /^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i.test(txt);
                }).map(el => ({
                    text: el.innerText.trim(),
                    class: el.className,
                    attributes: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`),
                    computedStyle: {
                        textDecoration: window.getComputedStyle(el).textDecoration,
                        opacity: window.getComputedStyle(el).opacity,
                        backgroundImage: window.getComputedStyle(el).backgroundImage
                    }
                }));
            } else {
                results.error = "Preto thumb not found";
            }

            return results;
        });

        console.log('DIAGNOSTIC DATA:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await browser.close();
    }
})();
