const { getExistingIdsFromDrive } = require('./driveManager');
const { isDuplicate } = require('./historyManager');
require('dotenv').config();

async function test5amLogic() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Usando Folder ID: ${folderId}`);

    try {
        console.log('📂 Coletando todos os itens do Google Drive...');
        const allDriveItems = await getExistingIdsFromDrive(folderId);
        console.log(`✅ Total de itens encontrados no Drive: ${allDriveItems.length}`);

        // 2. Filtrar favoritos e novidades
        const targetItems = allDriveItems.filter(item => item.isFavorito || item.novidade);
        console.log(`✅ Itens que passam no filtro Favorito/Novidade: ${targetItems.length}`);

        if (targetItems.length > 0) {
            console.log('\n--- Primeiros 10 itens filtrados ---');
            targetItems.slice(0, 10).forEach(item => {
                console.log(`- ${item.name} (ID: ${item.id}, Fav: ${item.isFavorito}, Nov: ${item.novidade})`);
            });
        }

        // 3. Simular verificação de duplicatas (Regra das 23h)
        console.log('\n🔍 Simulando verificação de duplicatas (Regra das 23h)...');
        const finalCandidates = targetItems.filter(item => {
            if (item.isFavorito) return true; // Favoritos sempre passam
            const alreadySent = isDuplicate(item.id, { maxAgeHours: 23 });
            return !alreadySent;
        });

        console.log(`✅ Candidatos finais após verificação de duplicatas: ${finalCandidates.length}`);

        const storeStats = {};
        finalCandidates.forEach(item => {
            storeStats[item.store] = (storeStats[item.store] || 0) + 1;
        });
        console.log('\n📊 Distribuição por Loja dos Candidatos:');
        Object.entries(storeStats).forEach(([store, count]) => {
            console.log(`   - ${store.toUpperCase()}: ${count}`);
        });

        const skippedDueToDuplicate = targetItems.filter(item => !item.isFavorito && isDuplicate(item.id, { maxAgeHours: 23 }));
        console.log(`\n⏭️ Ignorados por duplicata (23h): ${skippedDueToDuplicate.length}`);

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
}

test5amLogic();
