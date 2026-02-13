const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function test() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`Listing items from folder: ${folderId}`);
    try {
        const items = await getExistingIdsFromDrive(folderId);
        console.log(`Found ${items.length} items.`);

        console.log('--- Sample Items ---');
        items.slice(0, 20).forEach(item => {
            console.log(`File: "${item.name}" -> ID: "${item.id}"`);
        });

        const composites = items.filter(item => item.name.includes('_') || item.name.includes('-'));
        console.log(`\nFound ${composites.length} potentially composite items.`);
        composites.slice(0, 10).forEach(item => {
            console.log(`Composite Candidate: "${item.name}" -> Extracted ID: "${item.id}"`);
        });

    } catch (e) {
        console.error(e);
    }
}

test();
