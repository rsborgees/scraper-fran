
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function list() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const allDriveItems = await getExistingIdsFromDrive(folderId);
    const targetItems = allDriveItems.filter(item => item.isFavorito || item.novidade);

    console.log(`Total Target Items: ${targetItems.length}`);

    targetItems.forEach((item, index) => {
        if (item.id === '363187') {
            console.log(`🎯 FOUND at index ${index}:`, item);
        }
    });

    if (!targetItems.some(i => i.id === '363187')) {
        console.log('❌ 363187 NOT in targetItems.');
    }
}

list();
