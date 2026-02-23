const { loadHistory, normalizeId } = require('./historyManager');
const fs = require('fs');

function checkDresstoHistory() {
    const history = loadHistory();
    const driveItems = JSON.parse(fs.readFileSync('d:\\scrapping\\analyze_dressto_drive.js_results.json', 'utf8') || '[]'); // Wait, I didn't save results, I'll just load them again.
}

// Rewriting for simplicity
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function analyze() {
    const history = loadHistory();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const allDriveItems = await getExistingIdsFromDrive(folderId);
    const dressto = allDriveItems.filter(i => i.store === 'dressto');

    const now = Date.now();
    const sentToday = [];
    const sentRecently = [];

    dressto.forEach(item => {
        const normId = normalizeId(item.id);
        if (history[normId]) {
            const lastSentMs = history[normId].timestamp;
            const diffHours = (now - lastSentMs) / (1000 * 60 * 60);

            if (diffHours < 24) {
                sentToday.push({ id: item.id, hours: diffHours });
            } else if (diffHours < 72) {
                sentRecently.push({ id: item.id, hours: diffHours });
            }
        }
    });

    console.log(`\n--- DRESS TO HISTORY ANALYSIS ---`);
    console.log(`Total Dress To in Drive: ${dressto.length}`);
    console.log(`Sent in last 24h: ${sentToday.length}`);
    console.log(`Sent in 24h-72h: ${sentRecently.length}`);
    console.log(`Never sent (or matching failed): ${dressto.length - sentToday.length - sentRecently.length}`);

    if (sentToday.length > 0) {
        console.log('\nSample sent today:');
        sentToday.slice(0, 5).forEach(s => console.log(`- ${s.id} (${s.hours.toFixed(1)}h ago)`));
    }
}

analyze();
