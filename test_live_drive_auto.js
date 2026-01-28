const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeLiveByName } = require('./scrapers/live/nameScanner');
const { initBrowser } = require('./browser_setup');
require('dotenv').config();

(async () => {
    console.log('🚀 [LIVE DRIVE TEST] Iniciando teste automatizado com itens do Drive...');

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Acessando pasta do Drive: ${folderId}`);

    try {
        // 1. Buscar itens do Drive
        const allItems = await getExistingIdsFromDrive(folderId);
        const liveItems = allItems.filter(item => item.store === 'live');

        if (liveItems.length === 0) {
            console.log('⚠️ Nenhum item da loja "live" encontrado no Drive.');
            return;
        }

        console.log(`📊 Encontrados ${liveItems.length} itens da Live no Drive.`);

        // 2. Iniciar Browser
        const { browser, context } = await initBrowser();

        try {
            // 3. Executar Scraper (limitando a 5 para um teste rápido, ou todos se preferir)
            const quota = 5;
            console.log(`🚙 Testando os primeiros ${Math.min(liveItems.length, quota)} itens...`);

            const results = await scrapeLiveByName(context, liveItems.slice(0, quota), quota);

            console.log('\n==================================================');
            console.log(`✅ RESULTADOS DO TESTE (${results.length}/${Math.min(liveItems.length, quota)} capturados)`);
            console.log('==================================================');

            results.forEach((p, i) => {
                console.log(`\n[${i + 1}] PRODUTO: ${p.nome}`);
                console.log(`    💰 Preço: R$ ${p.preco} (De: R$ ${p.preco_original || p.preco})`);
                console.log(`    📏 Tamanhos: ${p.tamanhos.join(', ')}`);
                console.log(`    🎨 Grade: ${p.cor_tamanhos.replace(/\n/g, ' | ')}`);
                console.log(`    🔗 URL: ${p.url}`);
            });

            if (results.length === 0) {
                console.log('\n❌ Nenhum item foi capturado com sucesso. Verifique os logs acima para detalhes dos erros.');
            }

        } catch (err) {
            console.error('❌ Erro durante a execução do scraper:', err.message);
        } finally {
            await browser.close();
        }

    } catch (err) {
        console.error('❌ Erro ao acessar o Drive ou inicializar teste:', err.message);
    }

    console.log('\n🏁 Teste finalizado.');
})();
