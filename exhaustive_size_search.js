const { initBrowser } = require('./browser_setup');

async function exhaustiveSizeSearch() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Busca exaustiva de tamanhos em: ${url}`);

    const { browser, page } = await initBrowser();

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(5000);

        const results = await page.evaluate(() => {
            const findings = [];

            // 1. Procurar por todos os radio buttons
            const radios = document.querySelectorAll('input[type="radio"]');
            radios.forEach(r => {
                findings.push({
                    type: 'radio',
                    id: r.id,
                    className: r.className,
                    value: r.value,
                    name: r.name,
                    label: document.querySelector(`label[for="${r.id}"]`)?.innerText || 'No Label',
                    parentHtml: r.parentElement?.outerHTML.substring(0, 200)
                });
            });

            // 2. Procurar por elementos com classes que remetam a "sku", "size", "tamanho"
            const skuRelated = document.querySelectorAll('[class*="sku"], [class*="size"], [class*="tamanho"], [id*="sku"], [id*="size"], [id*="tamanho"]');
            skuRelated.forEach(el => {
                const text = el.innerText.trim();
                if (text && text.length < 20) {
                    findings.push({
                        type: 'class-match',
                        tag: el.tagName,
                        className: el.className,
                        text: text
                    });
                }
            });

            return findings;
        });

        console.log('✅ Resultados da busca exaustiva:');
        console.log(JSON.stringify(results.slice(0, 50), null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

exhaustiveSizeSearch();
