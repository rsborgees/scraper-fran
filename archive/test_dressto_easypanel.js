require('dotenv').config();
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { getExistingIdsFromDrive } = require('./driveManager');
const { initBrowser } = require('./browser_setup');

/**
 * Script de teste para DressTo no Easypanel
 * Testa os IDs do Drive com todas as correções implementadas
 */

async function testDressToEasypanel() {
    console.log('🧪 Teste DressTo no Easypanel - Iniciando...\n');

    try {
        // 1. Busca IDs do Drive
        console.log('📂 Buscando IDs do Drive para DressTo...');
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const driveItems = allDriveItems.filter(item => item.name.toLowerCase().includes('dress') || item.store === 'dressto');

        if (!driveItems || driveItems.length === 0) {
            console.log('⚠️  Nenhum item encontrado no Drive para DressTo.');
            console.log('   Testando com IDs fixos...');

            // IDs de teste fixos
            const testIds = [
                { id: '07010946', fileName: 'test1.jpg' },
                { id: '15010560', fileName: 'test2.jpg' }
            ];

            const { browser, context } = await initBrowser();
            const results = await scrapeSpecificIdsGeneric(context, testIds, 'dressto', 2);
            await browser.close();

            console.log('\n📊 Resultados do Teste:');
            console.log(`   ✅ Sucesso: ${results.stats.found}`);
            console.log(`   ❌ Erros: ${results.stats.errors}`);
            console.log(`   ⏭️  Duplicados: ${results.stats.duplicates}`);
            console.log(`   🔍 Não encontrados: ${results.stats.notFound}`);

            return;
        }

        console.log(`✅ Encontrados ${driveItems.length} itens no Drive`);
        console.log(`   Testando os primeiros 3 itens...\n`);

        // 2. Testa com os primeiros 3 IDs
        const testItems = driveItems.slice(0, 3);

        const { browser, context } = await initBrowser();
        const results = await scrapeSpecificIdsGeneric(context, testItems, 'dressto', 3);
        await browser.close();

        // 3. Mostra resultados
        console.log('\n📊 Resultados do Teste:');
        console.log(`   ✅ Sucesso: ${results.stats.found}`);
        console.log(`   ❌ Erros: ${results.stats.errors}`);
        console.log(`   ⏭️  Duplicados: ${results.stats.duplicates}`);
        console.log(`   🔍 Não encontrados: ${results.stats.notFound}`);

        if (results.stats.found > 0) {
            console.log('\n🎉 TESTE PASSOU! O scraper DressTo está funcionando no Easypanel!');
        } else {
            console.log('\n⚠️  Nenhum produto foi coletado com sucesso. Verifique os logs acima.');
        }

    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
        console.error(error.stack);
    }
}

// Executa o teste
testDressToEasypanel().then(() => {
    console.log('\n✅ Teste concluído.');
    process.exit(0);
}).catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
