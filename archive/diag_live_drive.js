const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function diag() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Checking Drive Folder: ${folderId}`);

    const items = await getExistingIdsFromDrive(folderId);
    const liveItems = items.filter(i => i.store === 'live');

    console.log(`\n📊 Total items: ${items.length}`);
    console.log(`📊 Live items: ${liveItems.length}`);

    liveItems.forEach((item, i) => {
        console.log(`\n[${i + 1}] Name: ${item.name}`);
        console.log(`    ID: ${item.id}`);
        console.log(`    IDS: ${JSON.stringify(item.ids)}`);
        console.log(`    SearchByName: ${item.searchByName}`);
        console.log(`    DriveUrl: ${item.driveUrl}`);
    });
}

diag().catch(console.error);
