const { initBrowser } = require('./browser_setup');

async function testAlphanumeric() {
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    // IDs to test (Full alphanumeric from Drive)
    const id = 'A5001811740003';
    const url = `https://www.zzmall.com.br/search/${id}`;

    console.log(`🚀 Testando busca por ID ALFANUMÉRICO: ${url}`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(8000);

        console.log(`📍 URL Final: ${page.url()}`);

        if (page.url().includes('/p/')) {
            console.log('✅ SUCESSO! Redirecionou para o produto.');
        } else {
            console.log('❌ FALHA! Redirecionou para novidades ou outra página.');
        }
    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        await browser.close();
    }
}

testAlphanumeric();
