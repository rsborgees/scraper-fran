/**
 * Script de Diagnóstico - Drive Sync Job
 * Analisa quantos itens favoritos/novidades estão disponíveis no Drive
 */

require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');
const { isDuplicate, normalizeId, loadHistory } = require('./historyManager');

async function diagnosticoDrive() {
    console.log('🔍 DIAGNÓSTICO DO DRIVE SYNC JOB\n');
    console.log('='.repeat(60));

    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!folderId) {
            console.error('❌ GOOGLE_DRIVE_FOLDER_ID não configurado no .env');
            return;
        }

        // 1. Buscar todos os itens do Drive
        console.log('📂 Buscando itens do Google Drive...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        console.log(`✅ Total de itens no Drive: ${allDriveItems.length}\n`);

        // 2. Filtrar favoritos e novidades (mesma lógica do job das 5h)
        const targetItems = allDriveItems.filter(item => item.isFavorito || item.novidade);
        console.log(`📊 Itens Favoritos ou Novidades: ${targetItems.length}`);
        console.log(`   - Favoritos: ${targetItems.filter(i => i.isFavorito).length}`);
        console.log(`   - Novidades: ${targetItems.filter(i => i.novidade).length}`);
        console.log(`   - Ambos: ${targetItems.filter(i => i.isFavorito && i.novidade).length}\n`);

        // 3. Agrupar por loja
        const byStore = {
            farm: targetItems.filter(i => i.store === 'farm'),
            dressto: targetItems.filter(i => i.store === 'dressto'),
            kju: targetItems.filter(i => i.store === 'kju'),
            live: targetItems.filter(i => i.store === 'live'),
            zzmall: targetItems.filter(i => i.store === 'zzmall')
        };

        console.log('📊 Distribuição por Loja:');
        Object.entries(byStore).forEach(([store, items]) => {
            if (items.length > 0) {
                const favs = items.filter(i => i.isFavorito).length;
                const novs = items.filter(i => i.novidade).length;
                console.log(`   ${store.toUpperCase()}: ${items.length} (${favs} fav, ${novs} nov)`);
            }
        });
        console.log('');

        // 4. Verificar duplicatas (Farm - 48h)
        const history = loadHistory();
        console.log('🔍 Análise de Duplicatas (Farm - 48h):');

        const farmItems = byStore.farm;
        const farmNonDuplicates = farmItems.filter(item => {
            const isDup = isDuplicate(normalizeId(item.id), {
                force: item.isFavorito,
                maxAgeHours: 48
            });
            return !isDup;
        });

        console.log(`   Total Farm: ${farmItems.length}`);
        console.log(`   Não duplicados: ${farmNonDuplicates.length}`);
        console.log(`   Duplicados (enviados < 48h): ${farmItems.length - farmNonDuplicates.length}\n`);

        // 5. Mostrar os itens que DEVERIAM ser enviados
        console.log('📋 Itens Farm que deveriam ser enviados:');
        farmNonDuplicates.slice(0, 20).forEach((item, idx) => {
            const flags = [];
            if (item.isFavorito) flags.push('FAV');
            if (item.novidade) flags.push('NOV');
            console.log(`   ${idx + 1}. ${item.id} [${flags.join(', ')}]`);
        });

        if (farmNonDuplicates.length > 20) {
            console.log(`   ... e mais ${farmNonDuplicates.length - 20} itens`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO:');
        console.log(`   Total disponível para envio: ${farmNonDuplicates.length + byStore.dressto.length + byStore.kju.length + byStore.live.length + byStore.zzmall.length}`);
        console.log(`   Farm: ${farmNonDuplicates.length}`);
        console.log(`   Outras lojas: ${byStore.dressto.length + byStore.kju.length + byStore.live.length + byStore.zzmall.length}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error.message);
        console.error(error.stack);
    }
}

// Executar
diagnosticoDrive().then(() => {
    console.log('\n✅ Diagnóstico concluído.');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Falha no diagnóstico:', error);
    process.exit(1);
});
