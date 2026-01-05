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

/**
 * Normaliza o ID para comparação consistente (remove zeros à esquerda e espaços)
 */
function normalizeId(id) {
    if (!id) return '';
    return String(id).trim().replace(/^0+/, '');
}

function isDuplicate(id) {
    if (!id) return false;
    const normId = normalizeId(id);
    if (!normId) return false;

    const history = loadHistory();

    return history.some(item => {
        const historyId = normalizeId(item);
        if (!historyId) return false;

        // Match exato ou um é prefixo do outro (ex: 350754-123 vs 350754)
        return historyId === normId ||
            historyId.startsWith(normId) ||
            normId.startsWith(historyId);
    });
}

function markAsSent(ids) {
    const history = loadHistory();
    const normalizedNewIds = ids.map(id => normalizeId(id)).filter(id => id);

    // Mantém o histórico original mas adiciona os novos normalizados
    // Idealmente deveríamos normalizar o histórico todo, mas vamos começar garantindo os novos
    const newHistory = [...new Set([...history, ...normalizedNewIds])];
    saveHistory(newHistory);
}

module.exports = { isDuplicate, markAsSent, loadHistory, normalizeId };
