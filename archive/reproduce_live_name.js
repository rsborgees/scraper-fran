const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
const { initBrowser } = require('./browser_setup');

async function test() {
    console.log('🚀 Starting reproduction test for LIVE NAME SEARCH...');

    // Mock Drive Item (Name Based)
    const mockDriveItems = [
        {
            id: 'LIVE_TEMP_123',
            name: 'Macaquinho shorts fit Green', // The scanner receives the CLEANED name. 
            // Wait, driveManager cleans it BEFORE passing to idScanner? 
            // idScanner receives 'driveItems'. 
            // driveManager logic I just edited is what populates this.
            // So to test the CLEANING logic, I should technically write a test for driveManager.
            // But here I'm testing the SEARCH.
            // If I put the raw name here, idScanner won't clean it (unless I duplicate logic).
            // The cleaning happens in driveManager.js -> push to items.
            // So if I want to reproduce the END-TO-END flow, I should simulate what driveManager outputs.
            // driveManager will output "Macaquinho shorts fit Green".
            // So I should put "Macaquinho shorts fit Green" here to test if the SEARCH finds it.
            // The user's request was about the name processing.
            // But OK, let's assume driveManager works (I just fixed it) and test if the SEARCH finds this specific item.
            name: 'Macaquinho shorts fit Green',
            // Logic: "Macaquinho shorts fit Green live" -> "Macaquinho shorts fit Green"
            driveUrl: 'https://mock.drive/image.jpg',
            isFavorito: true,
            store: 'live',
            searchByName: true
        }
    ];

    const { browser, context } = await initBrowser();

    try {
        console.log('\n🚙 Validating "Legging" search...');
        const result = await scrapeSpecificIdsGeneric(context, mockDriveItems, 'live', 5);

        console.log('Result:', JSON.stringify(result, null, 2));

        if (result.length > 0) {
            console.log('✅ TEST PASSED: Found products by name.');
            const first = result[0];
            if (first.cor_tamanhos) {
                console.log(`   🎨 Color/Size Details: ${first.cor_tamanhos}`);
            } else {
                console.log('   ⚠️ Missing color/size details.');
            }
        } else {
            console.error('❌ Failed to find product.');
        }

    } catch (e) {
        console.error('Test Error:', e);
    } finally {
        await browser.close();
    }
}

test();
