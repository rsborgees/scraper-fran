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
        if (!fs.existsSync(HISTORY_FILE)) {
            console.log(`⚠️  History file NOT found at: ${HISTORY_FILE}`);
            console.log('   Starting with empty history.');
            return {};
        }

        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        const parsed = JSON.parse(data);
        const rawIds = parsed.sent_ids || {};

        const entriesCount = Object.keys(rawIds).length;
        console.log(`📂 Loaded history from: ${HISTORY_FILE}`);
        console.log(`   Entries found: ${entriesCount}`);

        // Auto-migrate from old format (array) to new format (object with timestamps)
        if (Array.isArray(rawIds)) {
            console.log('📦 Migrando history.json para formato com timestamps...');
            const migratedIds = {};
            const now = Date.now();

            rawIds.forEach(id => {
                const normId = normalizeId(id);
                if (normId) {
                    migratedIds[normId] = {
                        timestamp: now,
                        lastSent: new Date().toISOString()
                    };
                }
            });

            saveHistory(migratedIds);
            return migratedIds;
        }

        // NOVO: Garantir que todas as chaves estão normalizadas (caso o usuário tenha editado manualmente)
        const normalizedHistory = {};
        Object.keys(rawIds).forEach(key => {
            const normKey = normalizeId(key);
            if (normKey) {
                normalizedHistory[normKey] = rawIds[key];
            }
        });

        return normalizedHistory;
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
    const sid = id.toString().trim();

    // Se contém letras e possui um tamanho razoável,
    // mantemos como está para evitar colisões em IDs alfanuméricos.
    if (/[a-zA-Z]/.test(sid) && sid.length >= 4) {
        return sid.toUpperCase();
    }

    // Preserva padrão NUMERO_NUMERO ou NUMERO-NUMERO (códigos com variação de cor)
    // Exemplo: 357793_51202 ou 357793-51202
    if (/^\d+[_-]\d+$/.test(sid)) {
        return sid.replace(/-/g, '_'); // Normaliza hífen para underscore
    }

    // Remove tudo que não é dígito e depois remove zeros à esquerda
    return sid.replace(/\D/g, '').replace(/^0+/, '');
}
/**
 * Verifica se um ID é duplicado
 * @param {string} id 
 * @param {object} options { force: boolean } - force=true para favoritos (podem repetir após 24h)
 * @param {number} price Preço do produto (não usado mais, mantido para compatibilidade)
 */
function isDuplicate(id, options = {}, price = 0) {
    if (!id) return false;
    const normId = normalizeId(id);
    if (!normId) return false;

    const history = loadHistory();
    const now = Date.now();

    // 0. Check Session Blocklist (Drive)
    if (sessionBlocklist.has(normId)) {
        console.log(`   🚫 ID Existente no Drive (Bloqueio de Sessão): ${normId}`);
        return true;
    }

    // 1. Busca no Histórico (Exact Match)
    let matchedIdInHistory = history[normId] ? normId : null;

    // 2. [DELETE] Busca no Histórico (Fuzzy Match - Inclusão/SKU)
    // Removido para evitar que IDs similares se bloqueiem indevidamente (ex: 363187 vs 36318755)

    // 3. Se achamos um registro no histórico
    if (matchedIdInHistory) {
        const entry = history[matchedIdInHistory];
        const ageMs = now - entry.timestamp;
        const ageHours = ageMs / (1000 * 60 * 60);

        // REGRA ESPECIAL: FAVORITOS (podem repetir quando o dia vira)
        if (options.force) {
            const entryDate = new Date(entry.timestamp);
            const today = new Date();

            const isSameDay = entryDate.getFullYear() === today.getFullYear() &&
                entryDate.getMonth() === today.getMonth() &&
                entryDate.getDate() === today.getDate();

            if (isSameDay) {
                console.log(`   🚫 Favorito ignorado: ID ${normId} já enviado HOJE.`);
                return true;
            }
            console.log(`   ✅ Favorito liberado: ID ${normId} enviado pela última vez em ${entry.lastSent} (dia diferente).`);
            return false;
        }

        // REGRA PADRÃO (RELAXADA): Itens podem repetir após 72h
        const effectiveMaxAge = options.maxAgeHours || MAX_AGE_HOURS;
        if (ageHours < effectiveMaxAge) {
            console.log(`   🚫 ID Duplicado detectado: ${normId} (Match: ${matchedIdInHistory}) enviado há ${ageHours.toFixed(1)}h [Regra: ${effectiveMaxAge}h]`);
            return true;
        }

        console.log(`   ✅ ID Liberado por tempo: ${normId} (match ${matchedIdInHistory}) enviado há ${ageHours.toFixed(1)}h.`);
        return false;
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
