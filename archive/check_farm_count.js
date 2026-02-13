const { getExistingIdsFromDrive } = require('./driveManager');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const HISTORY_PATH = path.join(__dirname, 'data', 'history.json');

async function main() {
    // 1. Get Folder ID
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error('GOOGLE_DRIVE_FOLDER_ID not found in .env');
        return;
    }

    // 2. Load History
    let history = { sent_ids: {} };
    if (fs.existsSync(HISTORY_PATH)) {
        try {
            history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
        } catch (e) {
            console.error('Error reading history.json', e);
        }
    }
    const sentIds = new Set(Object.keys(history.sent_ids || {}));

    console.log(`History Loaded: ${sentIds.size} items have been processed.`);

    // 3. Get Items from Drive
    console.log('Fetching file list from Drive...');
    const driveItems = await getExistingIdsFromDrive(folderId);

    // 4. Filter for Farm and Check Availability
    let farmItemsCount = 0;
    let availableCount = 0;
    let availableItems = [];

    driveItems.forEach(item => {
        if (item.store === 'farm') {
            farmItemsCount++;

            // Check if ANY of the IDs in the item (sets can have multiple) have been sent
            // If any ID in `item.ids` is in `sentIds`, consider it processed.

            const isProcessed = item.ids.some(id => sentIds.has(id));

            if (!isProcessed) {
                availableCount++;
                availableItems.push(item);
            }
        }
    });

    console.log('---------------------------------------------------');
    console.log(`Total Farm Items in Drive: ${farmItemsCount}`);
    console.log(`Already Processed (in History): ${farmItemsCount - availableCount}`);
    console.log(`Available to Process: ${availableCount}`);
    console.log('---------------------------------------------------');
}

main();
