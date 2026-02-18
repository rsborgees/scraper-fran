
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');

async function target() {
    const { browser, context } = await initBrowser();
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const all = await getExistingIdsFromDrive(folderId);
        const item = all.find(i => i.id === '363187');

        console.log('--- TARGET ITEM ---');
        console.log(item);

        const res = await scrapeSpecificIds(context, [item], 999);
        console.log('--- RESULT ---');
        console.log(JSON.stringify(res, null, 2));
    } finally {
        await browser.close();
    }
}

target();
