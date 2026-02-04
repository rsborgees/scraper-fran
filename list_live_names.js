const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function listLiveItems() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`🔍 Listing Live! items from folder: ${folderId}`);

    try {
        const items = await getExistingIdsFromDrive(folderId);
        const liveItems = items.filter(item => item.store === 'live');

        console.log(`\n✅ Found ${liveItems.length} Live! items.`);
        console.log('\n--- Real Drive Names (Top 20) ---');
        liveItems.slice(0, 20).forEach((item, i) => {
            console.log(`${i + 1}. "${item.name}" (Original: "${item.originalName || item.name}")`);
        });

    } catch (err) {
        console.error('Error:', err);
    }
}

listLiveItems();
