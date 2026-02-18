
const fs = require('fs');
const path = require('path');
const historyFile = path.join('data', 'history.json');

const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
const history = data.sent_ids || {};
const entries = Object.entries(history);

entries.sort((a, b) => b[1].timestamp - a[1].timestamp);

console.log('Latest 10 entries in history.json:');
entries.slice(0, 10).forEach(([id, entry]) => {
    console.log(`${id}: ${entry.lastSent} (${entry.timestamp})`);
});
console.log('Last update field in JSON:', data.last_update);
