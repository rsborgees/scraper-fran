const { initBrowser } = require('./browser_setup');

async function test() {
    console.log('Testando browser_setup...');
    try {
        const { browser, page } = await initBrowser();
        await page.goto('https://www.google.com');
        console.log('Página carregada:', await page.title());
        await browser.close();
        console.log('Browser fechado.');
    } catch (e) {
        console.error('Erro no teste:', e);
    }
}

test();
