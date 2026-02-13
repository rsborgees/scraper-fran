const { initBrowser } = require('./browser_setup');

async function debugProductDeco() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Depurando Deco.cx em: ${url}`);

    const { browser, page } = await initBrowser();

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(5000);

        const info = await page.evaluate(() => {
            const results = {
                buttons: [],
                labels: [],
                radios: [],
                buyButton: null
            };

            // Encontrar todos os botões e ver o que tem neles
            document.querySelectorAll('button').forEach(b => {
                const txt = b.innerText.trim();
                if (txt) {
                    results.buttons.push({ text: txt, class: b.className });
                    if (txt.toLowerCase().includes('adicionar') || txt.toLowerCase().includes('mochila')) {
                        results.buyButton = { text: txt, class: b.className, html: b.outerHTML.substring(0, 200) };
                    }
                }
            });

            // Encontrar labels de tamanho
            document.querySelectorAll('label, span').forEach(el => {
                const txt = el.innerText.trim();
                if (/^(PP|P|M|G|GG|G1|G2|G3|G4|34|36|38|40|42|44|46|48|U|UN)$/.test(txt)) {
                    results.labels.push({ text: txt, tag: el.tagName, class: el.className, parentClass: el.parentElement?.className });
                }
            });

            // Inputs
            document.querySelectorAll('input').forEach(i => {
                results.radios.push({ type: i.type, name: i.name, value: i.value, class: i.className });
            });

            return results;
        });

        console.log('✅ Botões encontrados:', info.buttons.length);
        console.log('✅ Buy Button:', JSON.stringify(info.buyButton, null, 2));
        console.log('✅ Tamanhos (Labels):', JSON.stringify(info.labels, null, 2));

        // Se não achou labels, vamos ver o HTML em volta de onde deveria estar o SKU
        const htmlNear = await page.evaluate(() => {
            const main = document.querySelector('main') || document.body;
            return main.innerHTML.substring(0, 5000); // Primeiros 5k do main
        });
        require('fs').writeFileSync('main_content_debug.html', htmlNear);

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

debugProductDeco();
