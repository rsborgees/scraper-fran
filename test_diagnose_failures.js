const { initBrowser } = require('./browser_setup');
const { scrapeDressTo } = require('./scrapers/dressto');
const { scrapeKJU } = require('./scrapers/kju');
const { scrapeLive } = require('./scrapers/live');
const fs = require('fs');
const path = require('path');

async function diagnose() {
    console.log('🧪 INICIANDO DIAGNÓSTICO DE FALHAS (MODO HEADLESS)');

    // Força modo headless para simular ambiente de servidor
    process.env.HEADLESS = 'true';

    const stores = [
        { name: 'DressTo', fn: scrapeDressTo },
        { name: 'KJU', fn: scrapeKJU },
        { name: 'Live', fn: scrapeLive }
    ];

    const { browser, page: dummyPage } = await initBrowser();

    for (const store of stores) {
        console.log(`\n--- Testando ${store.name} ---`);
        try {
            const products = await store.fn(1, browser); // Tenta pegar apenas 1 produto
            if (products.length > 0) {
                console.log(`✅ ${store.name}: SUCESSO! Coletou ${products.length} itens.`);
            } else {
                console.warn(`❌ ${store.name}: FALHA! Retornou 0 itens.`);
                // Tenta capturar screenshot da página de listagem se a página ainda estiver aberta
                // Nota: Os scrapers fecham suas próprias páginas internas, mas podemos tentar abrir uma nova
                const debugPage = await browser.newPage();

                // Add console log listener
                debugPage.on('console', msg => console.log(`[PAGE CONSOLE ${store.name}] ${msg.type().toUpperCase()}: ${msg.text()}`));

                const testUrl = store.name === 'DressTo' ? 'https://www.dressto.com.br/nossas-novidades' :
                    (store.name === 'KJU' ? 'https://www.kjubrasil.com/?ref=7B1313' : 'https://www.liveoficial.com.br/outlet');

                console.log(`📸 Capturando screenshot de debug para ${store.name} em: ${testUrl}`);
                await debugPage.goto(testUrl, { waitUntil: 'load', timeout: 30000 });
                // Espera manual após load
                await debugPage.waitForTimeout(5000);
                const screenshotPath = `debug_failure_${store.name.toLowerCase()}.png`;
                await debugPage.screenshot({ path: screenshotPath });
                console.log(`🖼️ Screenshot salvo: ${screenshotPath}`);
                await debugPage.close();
            }
        } catch (e) {
            console.error(`💥 Erro crítico em ${store.name}: ${e.message}`);
        }
    }

    await browser.close();
}

diagnose().catch(console.error);
