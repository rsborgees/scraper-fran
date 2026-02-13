const { initBrowser } = require('./browser_setup');

(async () => {
    const { browser, page } = await initBrowser();
    try {
        const url = 'https://www.liveoficial.com.br/macaquinho-shorts-fit-green-noir-black-P137800PT01/p';
        console.log(`Navegando para: ${url}`);

        // Use a much longer timeout and wait for load
        await page.goto(url, { waitUntil: 'load', timeout: 90000 });
        await page.waitForTimeout(10000); // Wait for animations/dynamic content

        // Screenshot
        await page.screenshot({ path: 'debug/live_product_debug_v2.png' });

        // Extrair dados específicos
        const data = await page.evaluate(() => {
            const main = document.querySelector('.vtex-flex-layout-0-x-flexRowContent--product-main');
            if (!main) return { error: 'Main container not found' };

            const prices = Array.from(main.querySelectorAll('span, div')).filter(el =>
                el.innerText.includes('R$') && el.innerText.length < 30
            ).map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.innerText.trim()
            }));

            const colorOptions = Array.from(main.querySelectorAll('li, div')).filter(el =>
                el.querySelector('img') && (el.className.includes('sku') || el.className.includes('color'))
            ).map(el => ({
                class: el.className,
                imgAlt: el.querySelector('img')?.alt || 'No alt',
                tag: el.tagName
            }));

            const sizeOptions = Array.from(main.querySelectorAll('li, div')).filter(el => {
                const txt = el.innerText.trim();
                return txt.length > 0 && txt.length <= 5 && ['PP', 'P', 'M', 'G', 'GG'].includes(txt.toUpperCase());
            }).map(el => ({
                text: el.innerText.trim(),
                class: el.className
            }));

            return {
                title: document.title,
                prices,
                colorOptions,
                sizeOptions,
                html: main.innerHTML.substring(0, 1000)
            };
        });

        console.log('DEBUG DATA:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await browser.close();
    }
})();
