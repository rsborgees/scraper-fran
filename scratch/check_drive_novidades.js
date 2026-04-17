const { getExistingIdsFromDrive } = require('./driveManager');
require('dotenv').config();

async function check() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const items = await getExistingIdsFromDrive(folderId);
    
    // Filtro mais robusto
    const farmNovidades = items.filter(item => 
        item.store === 'farm' && 
        (item.novidade || item.name.toLowerCase().includes('novidade'))
    );

    console.log(`\nFound ${farmNovidades.length} Farm novidades in Drive.`);
    
    // Ordenar por data de criação desc
    farmNovidades.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

    farmNovidades.slice(0, 10).forEach(item => {
        console.log(`- ${item.id} | ${item.name} | Created: ${item.createdTime}`);
    });
}

check();
