const { initBrowser } = require('./browser_setup');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');

async function verifyFix() {
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    // Alphanumeric ID provided by the user, currently available
    const testItems = [
        { id: 'A5001506080001', driveId: 'A5001506080001' }
    ];

    console.log('🚀 Iniciando Verificação do Fix ZZMall...');

    try {
        const result = await scrapeSpecificIdsGeneric(page, testItems, 'zzmall', 1);

        console.log('\n📊 RESULTADOS:');
        console.log(`Encontrados: ${result.stats.found}`);
        console.log(`Erros: ${result.stats.errors}`);

        if (result.products.length > 0) {
            const p = result.products[0];
            console.log('✅ SUCESSO!');
            console.log(`Nome: ${p.nome}`);
            console.log(`Preço: R$ ${p.precoAtual}`);
            console.log(`URL: ${p.url}`);
        } else {
            console.log('❌ FALHA: Nenhum produto capturado.');
            console.log('📍 URL Final no Script:', page.url());
            console.log('📄 Título da Página:', await page.title());
            await page.screenshot({ path: 'zzmall_failure.png' });
            console.log('📷 Screenshot salvo em zzmall_failure.png');
        }
    } catch (e) {
        console.error('❌ ERRO DURANTE TESTE:', e.message);
    } finally {
        await browser.close();
    }
}

verifyFix();
