const { initBrowser } = require('./browser_setup');

async function checkKjuProductId() {
    process.env.HEADLESS = 'true';
    const { browser, page } = await initBrowser();

    try {
        const url = 'https://www.kjubrasil.com/bolsa-artesanal-rio-m-farm-etc-alto-verao-2026/';
        console.log(`🔍 Navegando para Produto: ${url}`);

        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(5000);

        const data = await page.evaluate(() => {
            const getSafeText = (el) => el ? (el.innerText || el.textContent || '').trim() : '';
            const specificIdEl = document.querySelector('.codigo_produto, [itemprop="identifier"], .productReference');
            return {
                idText: getSafeText(specificIdEl),
                html: document.body.innerHTML.substring(0, 1000) // snippet
            };
        });

        console.log('✅ ID encontrado:', data.idText);
        // Search for more digits in the page
        const allText = await page.evaluate(() => document.body.innerText);
        const matches = allText.match(/\d{5,}/g);
        console.log('✅ Possíveis IDs (mais de 5 dígitos):', matches);

    } catch (e) {
        console.error(`❌ Erro: ${e.message}`);
    } finally {
        await browser.close();
    }
}

checkKjuProductId();
