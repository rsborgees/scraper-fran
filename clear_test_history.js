const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');

if (fs.existsSync(HISTORY_FILE)) {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    const sentIds = data.sent_ids || {};

    const idsToRemove = ['357978', '357979', '357978357979'];
    let removedCount = 0;

    idsToRemove.forEach(id => {
        if (sentIds[id]) {
            delete sentIds[id];
            removedCount++;
            console.log(`✅ Removido ID: ${id}`);
        }
    });

    if (removedCount > 0) {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
        console.log(`🎉 Total de ${removedCount} itens removidos do histórico.`);
    } else {
        console.log('⚠️ Nenhum dos IDs informados foi encontrado no histórico.');
    }
} else {
    console.log('❌ Arquivo de histórico não encontrado.');
}
