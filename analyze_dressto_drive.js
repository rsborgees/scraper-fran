const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function analyzeDressto() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    try {
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        const dressto = allDriveItems.filter(i => i.store === 'dressto');

        const favorites = dressto.filter(i => i.isFavorito);
        const novidades = dressto.filter(i => i.novidade);
        const both = dressto.filter(i => i.isFavorito && i.novidade);

        console.log('\n--- DRESS TO DRIVE ANALYSIS ---');
        console.log(`Total: ${dressto.length}`);
        console.log(`Favorites: ${favorites.length}`);
        console.log(`Novidades: ${novidades.length}`);
        console.log(`Both: ${both.length}`);
        console.log(`Regular (Neither): ${dressto.length - (favorites.length + novidades.length - both.length)}`);

    } catch (err) {
        console.error(err);
    }
}

analyzeDressto();
