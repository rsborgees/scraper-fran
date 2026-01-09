const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'data/history.json');

function clearRecentHistory(minutes = 60) {
    if (!fs.existsSync(HISTORY_FILE)) {
        console.log('❌ Arquivo de histórico não encontrado.');
        return;
    }

    try {
        const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        const now = Date.now();
        const cutoff = now - (minutes * 60 * 1000);

        let removedCount = 0;
        const newSentIds = {};

        // Filtra IDs antigos (mantém) e remove recentes
        for (const [id, data] of Object.entries(history.sent_ids)) {
            // Suporta formato antigo (bool) e novo (obj)
            const timestamp = (typeof data === 'object' && data.timestamp) ? data.timestamp : 0;

            if (timestamp < cutoff) {
                newSentIds[id] = data; // Mantém antigo
            } else {
                removedCount++; // Remove recente
            }
        }

        history.sent_ids = newSentIds;
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

        console.log(`\n🧹 LIMPEZA DE HISTÓRICO CONCLUÍDA`);
        console.log(`🕒 IDs removidos (últimos ${minutes} min): ${removedCount}`);
        console.log(`💾 IDs restantes: ${Object.keys(newSentIds).length}`);
        console.log(`\n👉 Agora você pode rodar o scraper novamente e ele vai pegar os produtos que foram testados.`);

    } catch (error) {
        console.error('Erro ao limpar histórico:', error.message);
    }
}

// Executa limpeza de 1 hora por padrão
clearRecentHistory(60);
