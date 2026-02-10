const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function diagnose() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`🔍 Diagnóstico da pasta: ${folderId}`);

    // Lista TUDO sem filtrar por dressto no scraper, mas vamos ver o que o driveManager faz
    const items = await getExistingIdsFromDrive(folderId, 'dressto');

    console.log(`\n📊 Resumo:`);
    console.log(`Total de itens identificados: ${items.length}`);

    const byStore = {};
    items.forEach(i => {
        byStore[i.store] = (byStore[i.store] || 0) + 1;
    });
    console.log('Por loja:', JSON.stringify(byStore, null, 2));

    console.log('\n📄 Amostra de itens dressto (primeiros 10):');
    items.filter(i => i.store === 'dressto').slice(0, 10).forEach(i => {
        console.log(`- ID: ${i.id} | Nome: ${i.name}`);
    });

    console.log('\n📄 Amostra de itens SEM LOJA (se houvesse, mas driveManager ignora):');
    // Para ver o que ele está ignorando, precisaríamos ler os arquivos brutos.
}

diagnose();
