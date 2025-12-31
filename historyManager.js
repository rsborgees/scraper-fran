const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'history.json');

// Initialize if not exists
if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ sent_ids: [] }));
}

function loadHistory() {
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data).sent_ids || [];
    } catch (e) {
        return [];
    }
}

function saveHistory(ids) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ sent_ids: ids, last_update: new Date().toISOString() }));
}

function isDuplicate(id) {
    const history = loadHistory();
    return history.includes(id);
}

function markAsSent(ids) {
    const history = loadHistory();
    const newHistory = [...new Set([...history, ...ids])];
    saveHistory(newHistory);
}

module.exports = { isDuplicate, markAsSent, loadHistory };
