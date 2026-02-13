const { initBrowser } = require('./browser_setup');

async function monitorNetwork() {
    console.log('🌐 Monitorando rede na aba Novidades...');
    const { browser, page } = await initBrowser();

    const requests = [];
    page.on('request', request => {
        const url = request.url();
        if (url.includes('api') || url.includes('search') || url.includes('products')) {
            requests.push({
                url: url,
                method: request.method(),
                headers: request.headers()
            });
        }
    });

    try {
        await page.goto('https://www.farmrio.com.br/novidades', { waitUntil: 'networkidle', timeout: 60000 });

        console.log('📜 Rolando...');
        await page.evaluate(() => window.scrollBy(0, 1500));
        await page.waitForTimeout(5000);

        console.log(`✅ Total de requisições de API/Busca: ${requests.length}`);

        // Vamos filtrar por requisições que pareçam retornar conteúdo de produtos
        const interesting = requests.filter(r =>
            r.url.includes('intelligent-search') ||
            r.url.includes('catalog_system') ||
            r.url.includes('deco/render')
        );

        console.log('✅ Requisições interessantes:', JSON.stringify(interesting.slice(0, 20), null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

monitorNetwork();
