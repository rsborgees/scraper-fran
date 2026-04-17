const { getExistingIdsFromDrive } = require('../driveManager');

async function analyzeDrive() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error('GOOGLE_DRIVE_FOLDER_ID not set');
        return;
    }

    console.log('--- Analyzing Drive Items ---');
    const items = await getExistingIdsFromDrive(folderId);
    console.log(`Total items found: ${items.length}`);

    const favors = items.filter(i => i.isFavorito);
    const news = items.filter(i => i.novidade);
    const bazars = items.filter(i => i.bazar);
    
    console.log(`Favoritos: ${favors.length}`);
    console.log(`Novidades: ${news.length}`);
    console.log(`Bazar: ${bazars.length}`);

    const candidates = items.filter(item => (item.isFavorito || item.novidade) && !item.bazar);
    console.log(`Candidates for 5 AM job (Favorito/Novidade AND NOT Bazar): ${candidates.length}`);

    if (candidates.length > 0) {
        console.log('Samples of 5 AM candidates:');
        candidates.slice(0, 5).forEach(c => {
            console.log(`  - [${c.store}] ${c.name} (Fav: ${c.isFavorito}, Nov: ${c.novidade})`);
        });
    }
}

analyzeDrive();
