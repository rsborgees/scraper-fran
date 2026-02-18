
const fs = require('fs');
const path = require('path');
const historyFile = path.join('data', 'history.json');

function normalizeId(id) {
    if (!id) return '';
    const sid = id.toString().trim();
    if (/[a-zA-Z]/.test(sid) && sid.length >= 4) return sid.toUpperCase();
    if (/^\d+[_-]\d+$/.test(sid)) return sid.replace(/-/g, '_');
    return sid.replace(/\D/g, '').replace(/^0+/, '');
}

const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
const history = data.sent_ids || {};
const now = Date.now();
const normId = normalizeId('363187');

console.log('Target ID:', normId);

Object.keys(history).forEach(key => {
    const entry = history[key];
    const ageHours = (now - entry.timestamp) / (1000 * 60 * 60);

    // Fuzzy match logic from historyManager.js
    if (ageHours < 48) {
        if (key.includes(normId) || normId.includes(key)) {
            console.log(`POTENTIAL FUZZY MATCH FOUND:`);
            console.log(`Key in History: ${key}`);
            console.log(`Age: ${ageHours.toFixed(1)}h`);
            console.log(`Entry:`, entry);
        }
    }
});

console.log('Search complete.');
