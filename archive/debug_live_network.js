const { chromium } = require('playwright');

(async () => {
    console.log('🕵️ INSPECTING NETWORK REQUESTS FOR LIVE SEARCH...');

    // Launch browser (HEADLESS for speed, but helpful to see logs)
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Log XMLHttpRequests and Fetches
    page.on('request', request => {
        if (['xhr', 'fetch'].includes(request.resourceType())) {
            const url = request.url();
            if (url.includes('liveoficial') && (url.includes('search') || url.includes('api') || url.includes('query'))) {
                console.log(`\n🔗 REQUEST: ${request.method()} ${url}`);
                // console.log(`   Headers: ${JSON.stringify(request.headers())}`);
            }
        }
    });

    try {
        console.log('   Navegando para Home...');
        await page.goto('https://www.liveoficial.com.br/', { waitUntil: 'domcontentloaded' });

        console.log('   Simulando busca...');
        // Tentar navegar direto para URL de busca para ver as requisições disparadas
        const query = 'macaquinho bermuda bynature preto';
        await page.goto(`https://www.liveoficial.com.br/busca?pesquisa=${encodeURIComponent(query)}`, { waitUntil: 'networkidle' });

        console.log('   Aguardando 5s para capturar requests...');
        await page.waitForTimeout(5000);

    } catch (e) {
        console.error('❌ Erro:', e.message);
    } finally {
        await browser.close();
    }
})();
