const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildLiveMessage } = require('./messageBuilder');

/**
 * Teste de integração completo: Live Drive Items
 * Testa o fluxo completo de pegar itens do Drive e processar via nameScanner
 */
async function testLiveDriveIntegration() {
    console.log('🧪 TESTE DE INTEGRAÇÃO: Live Drive Items\n');

    const { context, browser } = await initBrowser();

    try {
        // 1. Buscar itens Live do Drive
        console.log('📂 Buscando itens Live no Google Drive...');
        const allItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
        const liveItems = allItems.filter(i => i.store === 'live' && i.searchByName);

        console.log(`✅ Encontrados ${liveItems.length} itens Live\n`);

        if (liveItems.length === 0) {
            console.log('❌ Nenhum item Live encontrado. Teste abortado.');
            process.exit(1);
        }

        // 2. Processar 2 itens via idScanner (que delega para nameScanner)
        const testItems = liveItems.slice(0, 2);
        console.log('🔍 Processando itens via scrapeSpecificIdsGeneric:');
        testItems.forEach((item, i) => {
            console.log(`   ${i + 1}. "${item.name}"`);
        });
        console.log();

        const result = await scrapeSpecificIdsGeneric(context, testItems, 'live', 2);

        // 3. Verificar resultados
        console.log('\n' + '='.repeat(60));
        console.log('RESULTADOS');
        console.log('='.repeat(60));
        console.log(`Capturados: ${result.products.length}/${testItems.length}`);
        console.log(`Stats: ${JSON.stringify(result.stats)}\n`);

        if (result.products.length === 0) {
            console.log('❌ FALHA: Nenhum produto capturado!');
            console.log('   Verifique os logs acima para identificar o problema.');
            process.exit(1);
        }

        // 4. Exibir produtos capturados
        result.products.forEach((p, i) => {
            console.log(`Produto ${i + 1}:`);
            console.log(`   ID: ${p.id}`);
            console.log(`   Nome: ${p.nome}`);
            console.log(`   Preço: R$ ${p.preco}`);
            console.log(`   Tamanhos: ${p.tamanhos?.join(', ') || 'N/A'}`);
            console.log(`   Imagem Drive: ${p.imagePath ? '✅' : '❌'}`);
            console.log(`   URL: ${p.url}`);
            console.log();
        });

        // 5. Testar message builder
        console.log('📝 Testando message builder...');
        result.products.forEach(p => {
            p.message = buildLiveMessage([p]);
        });

        console.log(`✅ Mensagens geradas com sucesso\n`);

        // 6. Exibir uma mensagem de exemplo
        if (result.products.length > 0) {
            console.log('Exemplo de mensagem:');
            console.log('─'.repeat(60));
            console.log(result.products[0].message);
            console.log('─'.repeat(60));
        }

        console.log('\n✅ TESTE DE INTEGRAÇÃO PASSOU!');
        console.log(`   ${result.products.length} produtos capturados e processados com sucesso.`);

    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testLiveDriveIntegration().then(() => {
    console.log('\n✅ Teste concluído.');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Teste falhou:', err);
    process.exit(1);
});
