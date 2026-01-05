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
    if (!id) return false;
    const history = loadHistory();
    const targetId = String(id);

    return history.some(item => {
        const historyId = String(item);
        // Match exato ou um é prefixo do outro (ex: 350754-123 vs 350754)
        return historyId === targetId ||
            historyId.startsWith(targetId) ||
            targetId.startsWith(historyId);
    });
}

function markAsSent(ids) {
    const history = loadHistory();
    const stringIds = ids.map(id => String(id));
    const newHistory = [...new Set([...history, ...stringIds])];
    saveHistory(newHistory);
}

module.exports = { isDuplicate, markAsSent, loadHistory };
