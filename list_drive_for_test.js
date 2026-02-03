const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

(async () => {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Listing items from Drive folder: ${folderId}`);
    const items = await getExistingIdsFromDrive(folderId);
    console.log(`✅ Found ${items.length} items.`);

    // Take the first ZZMall item if exists, else first of any
    const zzmallItem = items.find(i => i.store === 'zzmall');
    const firstItem = zzmallItem || items[0];

    if (firstItem) {
        console.log('\nSelected item for test:');
        console.log(JSON.stringify(firstItem, null, 2));
    } else {
        console.log('❌ No items found in Drive.');
    }
})();
