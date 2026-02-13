const { initBrowser } = require('./browser_setup');

async function findSizeSelectors() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Buscando estrutura de tamanhos em: ${url}`);

    const { browser, page } = await initBrowser();

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        console.log('📜 Rolando...');
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(5000);

        const results = await page.evaluate(() => {
            const sizeLabels = ['PP', 'P', 'M', 'G', 'GG'];
            const found = [];

            const allElements = document.querySelectorAll('button, span, div, label, li');
            allElements.forEach(el => {
                const text = (el.innerText || el.textContent || '').trim();
                if (sizeLabels.includes(text) && el.children.length === 0) {
                    found.push({
                        tag: el.tagName,
                        text: text,
                        className: el.className,
                        parentTag: el.parentElement?.tagName,
                        parentClass: el.parentElement?.className,
                        grandParentClass: el.parentElement?.parentElement?.className
                    });
                }
            });

            const addToCart = Array.from(document.querySelectorAll('button, span'))
                .find(el => (el.innerText || '').toLowerCase().includes('mochila'))?.innerText;

            return { found, addToCart };
        });

        console.log('✅ Elementos de tamanho encontrados:');
        console.log(JSON.stringify(results, null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

findSizeSelectors();
