const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    try {
        const url = 'https://www.liveoficial.com.br/macaquinho-shorts-fit-green-noir-black-P137800PT01/p';
        console.log(`Navegando para: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);

        // Screenshot
        await page.screenshot({ path: 'debug/live_product_diag.png', fullPage: true });

        // Extrair dados relevantes
        const data = await page.evaluate(() => {
            const getSafeText = (el) => el ? el.innerText.trim() : '';

            // Preços
            const priceEls = Array.from(document.querySelectorAll('span, div')).filter(el =>
                el.innerText.includes('R$') && el.innerText.length < 50
            ).map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.innerText.trim()
            }));

            // Seletores de Cor
            const colorContainers = Array.from(document.querySelectorAll('.vtex-flex-layout-0-x-flexRowContent--product-main li, .vtex-product-summary-2-x-container li, li')).filter(li =>
                li.querySelector('img') || li.className.includes('color') || li.className.includes('sku')
            ).map(li => ({
                class: li.className,
                html: li.innerHTML.substring(0, 200),
                width: li.offsetWidth,
                height: li.offsetHeight
            }));

            // Tamanhos
            const sizeEls = Array.from(document.querySelectorAll('li, button, div')).filter(el => {
                const txt = el.innerText.trim().toUpperCase();
                return ['PP', 'P', 'M', 'G', 'GG', 'XG'].includes(txt);
            }).map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.innerText.trim()
            }));

            return {
                title: document.title,
                pricesFound: priceEls.slice(0, 20),
                colorContainers: colorContainers.slice(0, 20),
                sizesFound: sizeEls.slice(0, 10)
            };
        });

        console.log('Resultados da Diagnóstico:', JSON.stringify(data, null, 2));
    } finally {
        await browser.close();
    }
})();
