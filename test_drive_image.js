const { processImageDirect } = require('./imageDownloader');
require('dotenv').config();

(async () => {
    // Example Drive UC URL (using real ID found in driveManager.js for testing if possible, 
    // or just a known valid ID from recent runs if I can find one)
    // Looking at the history, I don't see the Drive IDs directly, but I can use a known pattern.
    const driveUrl = 'https://drive.google.com/uc?export=download&id=1_W5v1y9_QY4_-Q_-Q_-Q_-Q_-Q_-Q'; // Still mock-ish but testing the logic

    console.log('🚀 Testing processImageDirect with Drive URL...');
    try {
        const result = await processImageDirect(driveUrl, 'DRIVE_TEST', 'test_id');
        console.log('\n📊 Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error during test:', error);
    }
})();
