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

            // Focus on "Preto" and its sizes
            const colorThumbs = Array.from(document.querySelectorAll('img[src*="/color/"]'));
            const pretoThumb = colorThumbs.find(img => (img.alt || '').toLowerCase().includes('preto'));

            if (pretoThumb) {
                pretoThumb.click();
                await new Promise(r => setTimeout(r, 4000));

                const sizeEls = Array.from(document.querySelectorAll('[class*="sku-selector"], [class*="size"], [class*="tamanho"], button, li, label'));
                results.sizesWithPseudos = sizeEls.filter(el => {
                    const txt = (el.innerText || '').trim();
                    return /^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i.test(txt);
                }).map(el => {
                    const style = window.getComputedStyle(el);
                    const afterStyle = window.getComputedStyle(el, '::after');
                    const beforeStyle = window.getComputedStyle(el, '::before');

                    return {
                        text: el.innerText.trim(),
                        class: el.className,
                        bg: style.backgroundImage,
                        afterBg: afterStyle.backgroundImage,
                        beforeBg: beforeStyle.backgroundImage
                    };
                });
            }

            return results;
        });

        console.log('PSEUDO-ELEMENT DIAGNOSTIC:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await browser.close();
    }
})();
