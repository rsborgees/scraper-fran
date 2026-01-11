const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function run() {
    console.log('🧪 Testando Integração com Google Drive...');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
        console.error('❌ GOOGLE_DRIVE_FOLDER_ID não encontrado no .env');
        return;
    }

    console.log(`📂 Pasta Alvo: ${folderId}`);
    const ids = await getExistingIdsFromDrive(folderId);

    console.log('\n📊 Resultados:');
    console.log(`Total de IDs encontrados: ${ids.length}`);
    if (ids.length > 0) {
        console.log('Exemplos (primeiros 3):');
        console.log(JSON.stringify(ids.slice(0, 3), null, 2));
    }
}

run();
