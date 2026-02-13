const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

(async () => {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const items = await getExistingIdsFromDrive(folderId);

    // ZZMall items only
    const zzmall = items.filter(i => i.store === 'zzmall');

    console.log(`Found ${zzmall.length} ZZMall items in Drive.`);

    // Show the last 10 (most recent?)
    const lastItems = zzmall.slice(-10);
    console.log('\nLast 10 ZZMall items:');
    console.log(JSON.stringify(lastItems, null, 2));
})();
