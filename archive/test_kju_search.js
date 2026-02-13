const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function testKjuSearch() {
    process.env.HEADLESS = 'true';
    const { browser, page } = await initBrowser();

    try {
        const id = '36133853654';
        const url = `https://www.kjubrasil.com/busca/?q=${id}`;
        console.log(`🔍 Navegando para Search: ${url}`);

        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(5000);

        const content = await page.content();
        fs.writeFileSync('kju_search_debug.html', content);
        const productsCount = await page.evaluate(() => {
            return document.querySelectorAll('.produtos .item, .prod a, a.b_acao').length;
        });

        console.log(`✅ Encontrados ${productsCount} resultados na busca.`);
        await page.screenshot({ path: 'kju_search_debug.png' });

    } catch (e) {
        console.error(`❌ Erro: ${e.message}`);
    } finally {
        await browser.close();
    }
}

testKjuSearch();
