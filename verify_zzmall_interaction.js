const { initBrowser } = require('./browser_setup');

async function verifySearch() {
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    try {
        console.log('🚀 Indo para ZZMall...');
        await page.goto('https://www.zzmall.com.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        console.log('🔍 Pesquisando "arezzo"...');
        await page.click('.vtex-store-components-3-x-searchBarIcon');
        await page.waitForTimeout(500);
        await page.keyboard.type('arezzo');
        await page.keyboard.press('Enter');

        await page.waitForTimeout(10000); // Give it time

        console.log(`📍 URL Final: ${page.url()}`);

        const count = await page.evaluate(() => {
            return document.querySelectorAll('a[href*="/p/"]').length;
        });

        console.log(`📊 Produtos encontrados: ${count}`);

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        await browser.close();
    }
}

verifySearch();
