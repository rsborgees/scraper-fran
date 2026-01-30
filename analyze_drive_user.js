const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function analyzeDrive() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Analyzing Drive Folder: ${folderId}\n`);

    const items = await getExistingIdsFromDrive(folderId);
    const farmItems = items.filter(i => i.store === 'farm');

    console.log(`Total Farm items: ${farmItems.length}`);
    const favoritos = farmItems.filter(i => i.isFavorito);
    console.log(`Total Favoritos: ${favoritos.length}`);

    console.log('\n--- List of Favoritos (First 20) ---');
    favoritos.slice(0, 20).forEach((f, i) => {
        console.log(`${i + 1}. ${f.id} - ${f.name}`);
    });

    const userIds = [
        '358001',
        '356090',
        '355078',
        '356023',
        '356094',
        '356024',
        '358356',
        '358015'
    ];

    console.log('\n--- User IDs Status in Drive ---');
    userIds.forEach(uid => {
        const item = farmItems.find(fi => fi.ids.includes(uid) || fi.id === uid);
        if (item) {
            console.log(`✅ ${uid}: Found in Drive. Favorito: ${item.isFavorito ? 'YES' : 'NO'}. Name: ${item.name}`);
        } else {
            console.log(`❌ ${uid}: NOT FOUND in Drive folder.`);
        }
    });
}

analyzeDrive();
