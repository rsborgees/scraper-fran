const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

(async () => {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const items = await getExistingIdsFromDrive(folderId);

    const caughtIds = ['1906200310002', '1902701760002', '1902701660001', '1105700010178'];

    console.log('Searching for Drive items matching known available IDs...');
    const match = items.find(i => caughtIds.some(id => i.id.includes(id)));

    if (match) {
        console.log('\n✅ Found matching available item in Drive:');
        console.log(JSON.stringify(match, null, 2));
    } else {
        console.log('❌ No matching available items found in Drive. Using a caught ID as mock Drive item.');
        // Use the first caught ID
        console.log(JSON.stringify({
            id: caughtIds[0],
            driveUrl: 'https://drive.google.com/uc?export=download&id=1_W5v1y9_QY4_-Q_-Q_-Q_-Q_-Q_-Q', // Fake redirecting URL for logic test
            isFavorito: true,
            store: 'zzmall'
        }, null, 2));
    }
})();
