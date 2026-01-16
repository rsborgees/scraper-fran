// Test Drive-First for DressTo with mock data
const { chromium } = require('playwright');
const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');

async function test() {
    const browser = await chromium.launch({ headless: false });

    // Mock Drive items for DressTo
    const mockDriveItems = [
        {
            id: '01342814',
            driveUrl: 'https://drive.google.com/uc?export=download&id=MOCK_DRIVE_FILE_ID_123',
            isFavorito: false,
            store: 'dressto'
        }
    ];

    console.log('🧪 Testing DressTo Drive-First Flow...\n');
    console.log('Mock Drive Item:', mockDriveItems[0]);
    console.log('Expected: Product should have driveUrl as imageUrl/imagePath\n');

    const products = await scrapeSpecificIdsGeneric(browser, mockDriveItems, 'dressto', 1);

    if (products.length > 0) {
        const product = products[0];
        console.log('\n✅ PRODUCT SCRAPED:');
        console.log('   ID:', product.id);
        console.log('   Nome:', product.nome);
        console.log('   Tamanhos:', product.tamanhos);
        console.log('   ImageUrl:', product.imageUrl);
        console.log('   ImagePath:', product.imagePath);
        console.log('   Favorito:', product.favorito);
        console.log('   Loja:', product.loja);

        // Verify Drive URL is being used
        if (product.imageUrl === mockDriveItems[0].driveUrl) {
            console.log('\n✅ SUCCESS: Drive URL correctly applied to imageUrl!');
        } else {
            console.log('\n❌ ERROR: Drive URL NOT applied!');
            console.log('   Expected:', mockDriveItems[0].driveUrl);
            console.log('   Got:', product.imageUrl);
        }

        if (product.imagePath === mockDriveItems[0].driveUrl) {
            console.log('✅ SUCCESS: Drive URL correctly applied to imagePath!');
        } else {
            console.log('❌ ERROR: Drive URL NOT applied to imagePath!');
        }

        // Verify sizes don't have "DISPONÍVEL"
        const hasDisponivel = product.tamanhos.some(t => t.includes('DISPONÍVEL'));
        if (!hasDisponivel) {
            console.log('✅ SUCCESS: Sizes clean (no DISPONÍVEL)!');
        } else {
            console.log('❌ ERROR: Sizes still contain DISPONÍVEL!');
        }
    } else {
        console.log('\n❌ No products scraped!');
    }

    await browser.close();
}

test().catch(console.error);
