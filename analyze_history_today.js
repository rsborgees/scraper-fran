const fs = require('fs');
const path = require('path');

const HISTORY_FILE = 'd:/scrapping/data/history.json';

if (!fs.existsSync(HISTORY_FILE)) {
    console.log('History file not found');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
const history = data.sent_ids || {};
const todayStr = new Date().toISOString().split('T')[0];

console.log(`Analyzing history for date: ${todayStr}`);

const stats = {
    farm: 0,
    dressto: 0,
    kju: 0,
    live: 0,
    zzmall: 0,
    total: 0
};

// We don't have store info in history.json directly, but we can infer from some IDs or just look at timestamps
// To get store info, we might need a better approach, but let's at least see total sent today.

let todayCount = 0;
for (const id in history) {
    const entry = history[id];
    if (entry.lastSent && entry.lastSent.startsWith(todayStr)) {
        todayCount++;
    }
}

console.log(`Total items sent today (${todayStr}): ${todayCount}`);

// Let's try to find Dress To items (usually numeric 8 digits or formatted with dots)
// Actually, let's look at the IDs that were sent today
console.log('\nIDs sent today:');
for (const id in history) {
    const entry = history[id];
    if (entry.lastSent && entry.lastSent.startsWith(todayStr)) {
        console.log(`- ${id} (${entry.lastSent})`);
    }
}
