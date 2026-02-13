const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function checkDrive() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Buscando IDs no Google Drive (Pasta: ${folderId})...`);

    // getExistingIdsFromDrive returns an array of objects: { id, driveId, ... }
    const driveItems = await getExistingIdsFromDrive(folderId);
    const driveIds = driveItems.map(item => item.id);

    console.log(`✅ Total de IDs no Drive: ${driveIds.length}`);

    const candidates = [
        '358550', '356092', '357699', '355667', '355668', '356100', '357698', '357952'
    ];

    candidates.forEach(id => {
        const found = driveIds.includes(id);
        console.log(`ID ${id}: ${found ? '✅ JA EXISTE' : '❌ NOVO!'}`);
    });
}

checkDrive();
