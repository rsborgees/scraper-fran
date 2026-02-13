const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    try {
        const url = 'https://www.liveoficial.com.br/macaquinho-shorts-fit-green-noir-black-P137800PT01/p';
        console.log(`Navegando para: ${url}`);
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        await page.waitForTimeout(8000);

        const data = await page.evaluate(() => {
            const mainContainer = document.querySelector('.vtex-flex-layout-0-x-flexRowContent--product-main, .vtex-product-details-1-x-container, main');
            if (!mainContainer) return { error: "Main container not found" };

            // Find all elements with R$ in the main container
            const allElements = Array.from(mainContainer.querySelectorAll('*'));
            const priceElements = allElements.filter(el =>
                el.children.length === 0 && (el.innerText || '').includes('R$')
            );

            return priceElements.map(el => ({
                text: el.innerText.trim(),
                tag: el.tagName,
                class: el.className,
                parentClass: el.parentElement.className,
                grandParentClass: el.parentElement.parentElement ? el.parentElement.parentElement.className : ''
            }));
        });

        console.log('PRICE DIAGNOSTIC:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await browser.close();
    }
})();
