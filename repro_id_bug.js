const { normalizeId, isDuplicate, markAsSent, loadHistory } = require('./historyManager');
const fs = require('fs');
const path = require('path');

// Limpa histórico para teste
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');
const backup = fs.readFileSync(HISTORY_FILE, 'utf8');

function test() {
    console.log('🧪 Iniciando teste de reprodução de IDs Dress To...');

    const driveIdWithSpace = "02083403 03070283";
    const shortId = "02083403";

    console.log(`\n1. Normalização de "${driveIdWithSpace}": ${normalizeId(driveIdWithSpace)}`);
    console.log(`2. Normalização de "${shortId}": ${normalizeId(shortId)}`);

    console.log('\n--- Simulação do ID Scanner (Bug) ---');

    // Passo 1: Limpa histórico teste
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ sent_ids: {} }));

    // Passo 2: O Scanner checa o ID curto (item.id)
    const normCheck = normalizeId(shortId);
    const isDup = isDuplicate(normCheck);
    console.log(`Scanner: ID ${shortId} é duplicado? ${isDup}`);

    // Passo 3: O Scanner envia e marca o ID longo (item.driveId)
    console.log(`Scanner: Enviando e marcando ID longo ${driveIdWithSpace}...`);
    markAsSent([driveIdWithSpace]);

    // Passo 4: Próxima execução, checa o ID curto de novo
    const isDupNext = isDuplicate(normCheck);
    console.log(`Próxima execução: ID ${shortId} é duplicado? ${isDupNext}`);

    if (!isDupNext) {
        console.log('\n❌ BUG REPRODUZIDO: O ID curto não é detectado como duplicado mesmo após o longo ter sido enviado!');
    } else {
        console.log('\n✅ BUG NÃO REPRODUZIDO (estranho).');
    }

    // Restaura backup
    fs.writeFileSync(HISTORY_FILE, backup);
}

test();
