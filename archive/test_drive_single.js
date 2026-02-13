/**
 * Teste: Pega UM item do Drive e mostra o payload do webhook
 */
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { buildFarmMessage } = require('./messageBuilder');
const { initBrowser } = require('./browser_setup');
require('dotenv').config();

async function run() {
    console.log('🧪 TESTE DRIVE-FIRST (Único Produto)\n');

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error('❌ GOOGLE_DRIVE_FOLDER_ID não encontrado no .env');
        return;
    }

    // 1. Buscar itens do Drive
    console.log('📂 Buscando arquivos do Drive...');
    const allItems = await getExistingIdsFromDrive(folderId);

    if (allItems.length === 0) {
        console.log('❌ Nenhum item encontrado no Drive.');
        return;
    }

    // 2. Pegar os primeiros 5 itens para tentar (alguns podem não existir mais)
    const testItems = allItems.slice(0, 5);
    console.log(`\n📦 Itens disponíveis para teste (primeiros 5):`);
    testItems.forEach((item, i) => console.log(`  ${i + 1}. ID: ${item.id} | Favorito: ${item.isFavorito} | ${item.name}`));

    // 3. Abrir browser e scrape
    console.log('\n🌐 Iniciando browser...');
    const { browser } = await initBrowser();

    try {
        const products = await scrapeSpecificIds(browser, testItems);

        if (products.length === 0) {
            console.log('\n❌ Nenhum produto retornado (pode ter sido bloqueado/filtrado).');
            return;
        }

        // 4. Construir mensagem (como seria enviada)
        const product = products[0];
        product.message = buildFarmMessage(product, product.timerData);
        product.loja = 'farm';

        // 5. Mostrar payload final do webhook
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📤 PAYLOAD QUE SERIA ENVIADO AO WEBHOOK:');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(JSON.stringify(product, null, 2));
        console.log('\n═══════════════════════════════════════════════════════════');

    } finally {
        await browser.close();
        console.log('\n✅ Teste finalizado.');
    }
}

run().catch(console.error);
