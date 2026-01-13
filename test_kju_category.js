const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function testKjuCategory() {
    process.env.HEADLESS = 'true';
    const { browser, page } = await initBrowser();

    try {
        const url = 'https://www.kjubrasil.com/acessorios/';
        console.log(`🔗 Navegando para Category: ${url}`);

        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(5000);

        const content = await page.content();
        fs.writeFileSync('kju_category_debug.html', content);
        await page.screenshot({ path: 'kju_category_debug.png' });

        const productsCount = await page.evaluate(() => {
            return document.querySelectorAll('.produtos .item a, .prod a, a.b_acao').length;
        });

        console.log(`✅ Encontrados ${productsCount} produtos na categoria.`);

    } catch (e) {
        console.error(`❌ Erro: ${e.message}`);
    } finally {
        await browser.close();
    }
}

testKjuCategory();
