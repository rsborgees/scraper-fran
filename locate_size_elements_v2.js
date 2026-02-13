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
            const sizeLabels = ['PP', 'P', 'M', 'G', 'GG', 'U', 'UN'];

            const all = document.querySelectorAll('*');
            for (const el of all) {
                const txtContent = (el.innerText || el.textContent || '').trim();
                if (!txtContent) continue;

                if (sizeLabels.includes(txtContent) && el.children.length === 0) {
                    results.push({
                        type: 'SIZE',
                        text: txtContent,
                        tag: el.tagName,
                        class: el.className,
                        parentClass: el.parentElement?.className,
                        html: el.outerHTML.substring(0, 200)
                    });
                }

                const lowerTxt = txtContent.toLowerCase();
                if (lowerTxt === 'adicionar à mochila' || lowerTxt === 'adicionar na mochila' || lowerTxt === 'adicionar mochila' || lowerTxt === 'mochila') {
                    // Filtrar por botões ou links que pareçam o de compra
                    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.className.includes('button')) {
                        results.push({
                            type: 'BUY_BUTTON_CANDIDATE',
                            text: txtContent,
                            tag: el.tagName,
                            class: el.className,
                            html: el.outerHTML.substring(0, 200)
                        });
                    }
                }
            }

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
