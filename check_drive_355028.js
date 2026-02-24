const { findFileByProductId } = require('./driveManager');
require('dotenv').config();

async function check() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const productId = '355028';

    try {
        const file = await findFileByProductId(folderId, productId);
        if (file) {
            console.log('File found in Drive:', file.name);
            console.log('Bazar detected (simulated):', file.name.toLowerCase().includes('bazar'));
        } else {
            console.log('File not found in Drive');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

check();
