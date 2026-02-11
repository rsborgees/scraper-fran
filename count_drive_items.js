const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function count() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Acessando Drive: ${folderId}`);

    try {
        const allDriveItems = await getExistingIdsFromDrive(folderId);

        const novidades = allDriveItems.filter(item => item.novidade);
        const favoritos = allDriveItems.filter(item => item.isFavorito);
        const ambos = allDriveItems.filter(item => item.novidade && item.isFavorito);
        const apenasNovidades = allDriveItems.filter(item => item.novidade && !item.isFavorito);

        console.log('\n--- RESUMO DO DRIVE ---');
        console.log(`Total de itens: ${allDriveItems.length}`);
        console.log(`Total de Novidades: ${novidades.length}`);
        console.log(`Total de Favoritos: ${favoritos.length}`);
        console.log(`Itens que são ambos: ${ambos.length}`);
        console.log(`Itens APENAS Novidade: ${apenasNovidades.length}`);
        console.log('------------------------\n');

        // Agrupar por loja
        const stores = [...new Set(allDriveItems.map(i => i.store))];
        console.log('Por Loja:');
        stores.forEach(store => {
            const count = allDriveItems.filter(i => i.store === store).length;
            const novs = allDriveItems.filter(i => i.store === store && i.novidade).length;
            console.log(`- ${store.toUpperCase()}: ${count} total (${novs} novidades)`);
        });

    } catch (err) {
        console.error('Erro ao acessar Drive:', err);
    }
}

count();
