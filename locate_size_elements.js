const { initBrowser } = require('./browser_setup');

async function locateSizeElements() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Localizando elementos em: ${url}`);

    const { browser, page } = await initBrowser();

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        // Scroll lento
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 500));
            await page.waitForTimeout(1000);
        }

        const selectors = await page.evaluate(() => {
            const results = [];

            // 1. Achar botões de tamanho
            const sizeLabels = ['PP', 'P', 'M', 'G', 'GG'];
            document.querySelectorAll('*').forEach(el => {
                const txt = el.innerText.trim();
                if (sizeLabels.includes(txt) && el.children.length === 0) {
                    results.push({
                        type: 'SIZE',
                        text: txt,
                        tag: el.tagName,
                        class: el.className,
                        parentClass: el.parentElement?.className,
                        grandParentClass: el.parentElement?.parentElement?.className,
                        html: el.outerHTML.substring(0, 200)
                    });
                }

                if (txt.toLowerCase() === 'adicionar à mochila' || txt.toLowerCase() === 'adicionar na mochila' || txt.toLowerCase() === 'adicionar a mochila') {
                    results.push({
                        type: 'BUY_BUTTON',
                        text: txt,
                        tag: el.tagName,
                        class: el.className,
                        html: el.outerHTML.substring(0, 200)
                    });
                }
            });

            return results;
        });

        console.log('✅ Elementos localizados:');
        console.log(JSON.stringify(selectors, null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

locateSizeElements();
