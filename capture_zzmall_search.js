const { initBrowser } = require('./browser_setup');

async function captureSearchUrl() {
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    try {
        console.log('🚀 Indo para o site ZZMall...');
        await page.goto('https://www.zzmall.com.br/', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);

        console.log('🔍 Clicando no ícone de busca...');
        await page.click('.vtex-store-components-3-x-searchBarIcon');
        await page.waitForTimeout(1000);

        console.log('⌨️  Digitando ID...');
        await page.keyboard.type('A5001811740003');
        await page.keyboard.press('Enter');

        console.log('⏳ Esperando redirecionamento...');
        await page.waitForTimeout(8000);

        console.log(`📍 URL Final Capturada: ${page.url()}`);

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        await browser.close();
    }
}

captureSearchUrl();
