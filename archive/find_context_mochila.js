const { initBrowser } = require('./browser_setup');

async function findContextNearMochila() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Buscando contexto perto de 'Mochila' em: ${url}`);

    const { browser, page } = await initBrowser();

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(5000);

        const results = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button, span, div'))
                .find(el => (el.innerText || '').trim() === 'Mochila');

            if (!btn) return 'Botão Mochila não encontrado';

            const parent = btn.parentElement;
            const container = parent?.parentElement?.parentElement; // Tentar subir alguns níveis

            return {
                btnHtml: btn.outerHTML,
                parentClass: parent?.className,
                containerHtml: container?.outerHTML.substring(0, 2000)
            };
        });

        console.log('✅ Contexto encontrado:');
        console.log(JSON.stringify(results, null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

findContextNearMochila();
