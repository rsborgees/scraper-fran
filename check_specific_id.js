
require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');

async function check() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const items = await getExistingIdsFromDrive(folderId);
    const match = items.find(i => i.id.includes('363187') || i.name.includes('363187'));

    if (match) {
        console.log('✅ Found match in Drive:');
        console.log(JSON.stringify(match, null, 2));
    } else {
        console.log('❌ NOT found in Drive listing.');
        const allNames = items.map(i => i.name).slice(0, 50);
        console.log('Sample names found:', allNames);
    }
}

check();
