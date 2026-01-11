const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const MAX_AGE_HOURS = 72; // 3 days

// Cache em memória para IDs externos (ex: Google Drive)
// Estes IDs não serão salvos no JSON, mas impedirão o scraping na sessão atual
let sessionBlocklist = new Set();

// Initialize if not exists
if (!fs.existsSync(HISTORY_FILE)) {
    // Tenta migrar do antigo se existir
    const OLD_FILE = path.join(__dirname, 'history.json');
    if (fs.existsSync(OLD_FILE)) {
        console.log('📦 Migrando histórico antigo para pasta data/...');
        fs.renameSync(OLD_FILE, HISTORY_FILE);
    } else {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ sent_ids: {}, format_version: 2 }));
    }
}

function loadHistory() {
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        const parsed = JSON.parse(data);

        // Auto-migrate from old format (array) to new format (object with timestamps)
        if (Array.isArray(parsed.sent_ids)) {
            console.log('📦 Migrando history.json para formato com timestamps...');
            const migratedIds = {};
            const now = Date.now();

            parsed.sent_ids.forEach(id => {
                if (id) {
                    const normId = normalizeId(id);
                    if (normId) {
                        migratedIds[normId] = {
                            timestamp: now,
                            lastSent: new Date().toISOString()
                        };
                    }
                }
            });

            saveHistory(migratedIds);
            console.log(`✅ Migrado ${Object.keys(migratedIds).length} IDs para novo formato`);
            return migratedIds;
        }

        return parsed.sent_ids || {};
    } catch (e) {
        console.error('Erro ao carregar histórico:', e.message);
        return {};
    }
}

function saveHistory(idsObject) {
    const data = {
        sent_ids: idsObject,
        format_version: 2,
        last_update: new Date().toISOString()
    };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

/**
 * Normaliza o ID para comparação consistente (remove zeros à esquerda e espaços)
 */
function normalizeId(id) {
    if (!id) return '';
    return String(id).trim().replace(/^0+/, '');
}

/**
 * Verifica se um ID é duplicado baseado em tempo (3 dias)
 * @param {string} id 
 * @param {object} options { force: boolean }
 */
function isDuplicate(id, options = {}) {
    if (!id) return false;

    // Se force=true (ex: Favorito do Drive), ignora duplicação
    if (options.force) return false;

    const normId = normalizeId(id);
    if (!normId) return false;

    const history = loadHistory();
    const now = Date.now();
    const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000; // 72 hours in milliseconds

    // 0. Check Session Blocklist (Drive)
    if (sessionBlocklist.has(normId)) {
        console.log(`   🚫 ID Existente no Drive (Bloqueio de Sessão): ${normId}`);
        return true;
    }

    // Match exato por ID normalizado
    if (history[normId]) {
        const ageMs = now - history[normId].timestamp;
        const ageHours = ageMs / (1000 * 60 * 60);

        if (ageMs < maxAgeMs) {
            console.log(`   🚫 ID Duplicado detectado: ${normId} (Encontrado no histórico como: ${normId})`);
            console.log(`      ⏱️  Enviado há ${ageHours.toFixed(1)}h (max: ${MAX_AGE_HOURS}h)`);
            return true;
        } else {
            console.log(`   ♻️  ID ${normId} expirado (${ageHours.toFixed(1)}h) - pode ser re-scraped`);
            return false;
        }
    }

    // Verifica match de prefixo para IDs complexos (SKU-COLOR-SIZE)
    const duplicate = Object.keys(history).find(historyId => {
        // Se ambos forem puramente numéricos, exigimos match exato
        const isNumeric = /^\d+$/.test(normId) && /^\d+$/.test(historyId);
        if (isNumeric) return false;

        // Para IDs complexos, permitimos match de prefixo
        return historyId.startsWith(normId) || normId.startsWith(historyId);
    });

    if (duplicate) {
        const ageMs = now - history[duplicate].timestamp;
        const ageHours = ageMs / (1000 * 60 * 60);

        if (ageMs < maxAgeMs) {
            console.log(`   🚫 ID Duplicado detectado: ${normId} (Encontrado no histórico como: ${duplicate})`);
            console.log(`      ⏱️  Enviado há ${ageHours.toFixed(1)}h (max: ${MAX_AGE_HOURS}h)`);
            return true;
        } else {
            console.log(`   ♻️  ID ${duplicate} expirado (${ageHours.toFixed(1)}h) - pode ser re-scraped`);
            return false;
        }
    }

    return false;
}

/**
 * Marca IDs como enviados com timestamp atual
 */
function markAsSent(ids) {
    const history = loadHistory();
    const now = Date.now();
    const timestamp = new Date().toISOString();

    ids.forEach(id => {
        const normId = normalizeId(id);
        if (normId) {
            history[normId] = {
                timestamp: now,
                lastSent: timestamp
            };
        }
    });

    // Opcional: Limpar IDs muito antigos (> 30 dias) para manter o arquivo enxuto
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    Object.keys(history).forEach(id => {
        if (now - history[id].timestamp > thirtyDaysMs) {
            delete history[id];
        }
    });

    saveHistory(history);
}

function addToSessionBlocklist(ids) {
    if (!Array.isArray(ids)) return;
    ids.forEach(id => {
        const norm = normalizeId(id);
        if (norm) sessionBlocklist.add(norm);
    });
    console.log(`🔒 ${ids.length} IDs adicionados à blocklist da sessão (Drive/Externo)`);
}

module.exports = { isDuplicate, markAsSent, loadHistory, normalizeId, addToSessionBlocklist };
