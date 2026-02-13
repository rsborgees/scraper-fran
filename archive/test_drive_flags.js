
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function testDriveFlags() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error('❌ Folder ID not found in .env');
        return;
    }

    try {
        console.log(`📂 Checking Drive Folder: ${folderId}`);
        const allItems = await getExistingIdsFromDrive(folderId);

        console.log(`\n🔍 Verifying flags for first 10 items:`);
        allItems.slice(0, 10).forEach(item => {
            console.log(`---`);
            console.log(`Name: ${item.name}`);
            console.log(`   novidade: ${item.novidade}`);
            console.log(`   bazar: ${item.bazar}`);
            console.log(`   isFavorito: ${item.isFavorito}`);
            console.log(`   bazarFavorito: ${item.bazarFavorito}`);
        });

        const novidadeCount = allItems.filter(i => i.novidade).length;
        const bazarCount = allItems.filter(i => i.bazar).length;
        const favoriteCount = allItems.filter(i => i.isFavorito).length;
        const bazarFavoritoCount = allItems.filter(i => i.bazarFavorito).length;

        console.log(`\n📊 Drive Stats:`);
        console.log(`   Total items: ${allItems.length}`);
        console.log(`   Novidade: ${novidadeCount}`);
        console.log(`   Bazar: ${bazarCount}`);
        console.log(`   Favoritos: ${favoriteCount}`);
        console.log(`   Bazar Favorito: ${bazarFavoritoCount}`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testDriveFlags();
