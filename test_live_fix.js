// Final verification for Live Search Fix
const { chromium } = require('playwright');
const { scrapeLiveByName } = require('./scrapers/live/nameScanner');

async function test() {
    const browser = await chromium.launch({ headless: false });

    const mockDriveItems = [
        {
            name: 'macaquinho shorts fit green',
            driveUrl: 'https://drive.google.com/uc?export=download&id=MOCK_LIVE_DRIVE_ID',
            isFavorito: false,
            store: 'live',
            searchByName: true
        }
    ];

    console.log('🧪 Testing Live Name Search Fix...\n');

    try {
        const products = await scrapeLiveByName(browser, mockDriveItems, 1);

        if (products.length > 0) {
            const p = products[0];
            console.log('\n✅ SUCCESS: Product found!');
            console.log('   Nome:', p.nome);
            console.log('   URL:', p.url);
            console.log('   Cores/Tamanhos:', p.cor_tamanhos);
            console.log('   ImageUrl:', p.imageUrl);

            if (p.url.includes('macaquinho-shorts-fit-green')) {
                console.log('✅ URL correctly matches search term!');
            } else {
                console.log('⚠️ URL might not match perfectly');
            }
        } else {
            console.log('\n❌ FAILED: No product found for "macaquinho shorts fit green"');
        }
    } catch (err) {
        console.error('\n❌ ERROR during test:', err.message);
    } finally {
        await browser.close();
    }
}

test();
