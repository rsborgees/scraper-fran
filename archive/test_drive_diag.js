const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function diagnose() {
    console.log('🔍 INICIANDO DIAGNÓSTICO DO DRIVE...');
    console.log('-----------------------------------');

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log('Folder ID:', folderId || '❌ NÃO DEFINIDO');
    console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? '✅ DEFINIDO' : '❌ NÃO DEFINIDO');
    console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✅ DEFINIDO' : '❌ NÃO DEFINIDO');
    console.log('Refresh Token:', process.env.GOOGLE_REFRESH_TOKEN ? '✅ DEFINIDO' : '❌ NÃO DEFINIDO');
    console.log('Token JSON:', process.env.GOOGLE_TOKEN_JSON ? '✅ DEFINIDO' : '❌ NÃO DEFINIDO');

    if (!folderId) {
        console.log('❌ Erro: GOOGLE_DRIVE_FOLDER_ID está faltando.');
        return;
    }

    try {
        const items = await getExistingIdsFromDrive(folderId);
        if (items.length === 0) {
            console.log('⚠️ Nenhum item processável encontrado. Verifique o nome dos arquivos (deve conter "farm", "dress", etc e o ID).');
        } else {
            console.log(`✅ Sucesso! Encontrados ${items.length} itens.`);
            console.log('Exemplo do primeiro item:', items[0]);
        }
    } catch (e) {
        console.error('❌ Erro crítico no diagnóstico:', e.message);
    }
}

diagnose();
