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

    const duplicate = history.find(item => {
        const historyId = normalizeId(item);
        if (!historyId) return false;

        // Match exato
        if (historyId === normId) return true;

        // Se ambos forem puramente numéricos e curtos (ex: 351062), não usamos startsWith
        // para evitar que "351" bloqueie "351062".
        // Só usamos startsWith se um deles for um ID de SKU completo (com traço ou longo)
        const isNumeric = /^\d+$/.test(normId) && /^\d+$/.test(historyId);

        if (isNumeric) {
            // Para números puros, exigimos match exato ou que um seja muito maior que o outro 
            // e contenha o outro como prefixo (ex: 351062-001 vs 351062)
            // Mas IDs da Farm são truncados para 6, então match exato é o padrão.
            return false;
        }

        // Para IDs complexos (ex: SKU-COLOR-SIZE), permitimos match de prefixo
        return historyId.startsWith(normId) || normId.startsWith(historyId);
    });

    if (duplicate) {
        console.log(`   🚫 ID Duplicado detectado: ${normId} (Encontrado no histórico como: ${duplicate})`);
        return true;
    }

    return false;
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
