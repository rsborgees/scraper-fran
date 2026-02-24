const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function count() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Acessando Drive: ${folderId}`);

    try {
        const allDriveItems = await getExistingIdsFromDrive(folderId);

        const stores = [...new Set(allDriveItems.map(i => i.store))];
        console.log('\n--- ESTATÍSTICAS DETALHADAS DO DRIVE ---');

        stores.sort().forEach(store => {
            const storeItems = allDriveItems.filter(i => i.store === store);
            const total = storeItems.length;
            const novidades = storeItems.filter(i => i.novidade).length;
            const favoritos = storeItems.filter(i => i.isFavorito).length;
            const ambos = storeItems.filter(i => i.novidade && i.isFavorito).length;

            console.log(`\nLOJA: ${store.toUpperCase()}`);
            console.log(`  Total: ${total}`);
            console.log(`  Favoritos: ${favoritos}`);
            console.log(`  Novidades: ${novidades}`);
            console.log(`  Ambos (Fav + Nov): ${ambos}`);
        });

        console.log('\n----------------------------------------');
        console.log(`TOTAL GERAL: ${allDriveItems.length}`);
        console.log(`TOTAL FAVORITOS: ${allDriveItems.filter(i => i.isFavorito).length}`);
        console.log(`TOTAL NOVIDADES: ${allDriveItems.filter(i => i.novidade).length}`);

    } catch (err) {
        console.error('Erro ao acessar Drive:', err);
    }
}

count();
