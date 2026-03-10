
const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function diagnose() {
    console.log('🔍 Diagnosticando itens da FARM no Drive...');
    const allDriveItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);

    const farmItems = allDriveItems.filter(i => i.store === 'farm');

    const counts = {
        bazar: 0,
        favorito: 0,
        novidade: 0,
        bazarFavorito: 0,
        normal: 0,
        total: farmItems.length
    };

    farmItems.forEach(i => {
        if (i.bazar) {
            counts.bazar++;
            if (i.isFavorito) counts.bazarFavorito++;
        } else if (i.isFavorito) {
            counts.favorito++;
        } else if (i.novidade) {
            counts.novidade++;
        } else {
            counts.normal++;
        }
    });

    console.log('\n📊 Estatísticas FARM no Drive:');
    console.table(counts);

    if (counts.normal < 6) {
        console.warn('⚠️ AVISO: Menos de 6 itens "NORMAIS" encontrados no Drive.');
    }
}

diagnose();
