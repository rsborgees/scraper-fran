const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function findConjuntos() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`🔍 Buscando conjuntos na pasta ${folderId}...`);

    // Configura log de progresso para a função getExistingIdsFromDrive
    const originalLog = console.log;
    // console.log = () => {}; // Desativa logs internos para não poluir

    const items = await getExistingIdsFromDrive(folderId);

    // console.log = originalLog;

    const sets = items.filter(item => item.isSet && item.store === 'farm');

    console.log(`\n✅ Encontrados ${sets.length} conjuntos da Farm no Drive:`);
    sets.forEach(s => {
        console.log(`- Nome: ${s.name} | IDs: ${s.ids.join(' ')}`);
    });
}

findConjuntos();
