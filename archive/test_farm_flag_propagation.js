
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');

async function testFarmFlagPropagation() {
    const { browser, context } = await initBrowser();

    // Mock Drive item
    const mockItems = [
        {
            id: '357261',
            ids: ['357261'],
            isSet: false,
            fileId: 'mock_file_id',
            name: '357261 Farm Inverno Novidade.jpg',
            driveUrl: 'https://drive.google.com/uc?export=download&id=mock_file_id',
            isFavorito: false,
            novidade: true,
            bazar: false,
            bazarFavorito: false,
            store: 'farm'
        }
    ];

    try {
        console.log('🧪 Testing flag propagation for Farm ID 357261 (Novidade: true)');
        const { products } = await scrapeSpecificIds(context, mockItems, 1);

        if (products.length > 0) {
            const p = products[0];
            console.log('\n✅ Scraped Product:');
            console.log(`   ID: ${p.id}`);
            console.log(`   Nome: ${p.nome}`);
            console.log(`   novidade: ${p.novidade} (${typeof p.novidade})`);
            console.log(`   bazar: ${p.bazar} (${typeof p.bazar})`);
            console.log(`   favorito: ${p.favorito} (${typeof p.favorito})`);
            console.log(`   bazarFavorito: ${p.bazarFavorito} (${typeof p.bazarFavorito})`);
        } else {
            console.log('❌ Product not found or scraped.');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

testFarmFlagPropagation();
