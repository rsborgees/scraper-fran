/**
 * Teste rápido para verificar detecção de loja a partir do Drive
 */
require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');

async function test() {
    const items = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);

    console.log('📦 Exemplos de itens com detecção de loja:');
    items.slice(0, 10).forEach(i => {
        console.log(`  ${i.id} -> store: ${i.store} | favorito: ${i.isFavorito} | ${i.name}`);
    });

    // Estatísticas por loja
    const byStore = {};
    items.forEach(i => {
        byStore[i.store] = (byStore[i.store] || 0) + 1;
    });

    console.log('\n📊 Total por loja:');
    Object.entries(byStore).forEach(([store, count]) => {
        console.log(`   ${store.toUpperCase()}: ${count} itens`);
    });
}

test();
