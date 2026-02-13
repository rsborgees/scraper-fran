const fs = require('fs');
const path = require('path');
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

const ARTIFACT_DIR = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1';
const content = fs.readFileSync(path.join(ARTIFACT_DIR, 'shelf_fragment.html'), 'utf-8');

const linkRegex = /href="([^"]+)"/g;
let match;
const links = new Set();
while ((match = linkRegex.exec(content)) !== null) {
    const url = match[1];
    if (url.includes('/p?') || url.includes('/p/')) {
        links.add(url.startsWith('http') ? url : 'https://www.farmrio.com.br' + url);
    }
}

async function run() {
    const driveItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
    const driveIds = driveItems.map(item => item.id);

    console.log(`Total links found in shelf: ${links.size}`);

    const candidates = Array.from(links).map(url => {
        const idMatch = url.match(/-(\d{6,})-\d+/);
        const id = idMatch ? idMatch[1] : null;
        return { url, id };
    }).filter(c => c.id && !driveIds.includes(c.id));

    console.log(`New candidates (NOT in Drive): ${candidates.length}`);
    console.log(JSON.stringify(candidates.slice(0, 10), null, 2));
}

run();
