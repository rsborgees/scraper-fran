const fs = require('fs');
const path = require('path');
const { scanFarmPromo } = require('./farmScanner');

const STATE_FILE = path.join(__dirname, 'last_banner_state.json');

/**
 * Monitora mudanças nos banners da Farm Rio.
 * Compara estado atual com último salvo em JSON.
 */
async function watch() {
    console.log('[Watcher] Iniciando verificação horária...');

    const currentData = await scanFarmPromo();

    if (!currentData) {
        console.log('[Watcher] Falha ao ler dados atuais (null). Ignorando ciclo.');
        return;
    }

    let lastState = {};
    if (fs.existsSync(STATE_FILE)) {
        try {
            lastState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch (e) {
            console.error('Erro ao ler estado anterior:', e);
        }
    }

    // Comparação de título e descrição
    const hasChanged = (currentData.titulo !== lastState.titulo) ||
        (currentData.descricao !== lastState.descricao);

    if (hasChanged) {
        console.log('[Watcher] MUDANÇA DE PROMOÇÃO DETECTADA!');
        console.log(`ANTERIOR: ${lastState.titulo || 'N/A'}`);
        console.log(`ATUAL:    ${currentData.titulo}`);

        // Aqui poderia disparar um alerta real (email, webhook, etc)
        // Por hora, apenas atualiza o estado
        fs.writeFileSync(STATE_FILE, JSON.stringify(currentData, null, 2));
        console.log('[Watcher] Estado atualizado em disco.');
    } else {
        console.log('[Watcher] Nenhuma alteração nos banners.');
    }
}

module.exports = { watch };
