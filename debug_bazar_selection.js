const { distributeLinks } = require('./distributionEngine');
const { runAllScrapers } = require('./orchestrator');

async function debugBazarSelection() {
    console.log('🔍 Starting Bazar Selection Diagnostic...');

    // 1. Run a lightweight scrape (test mode)
    // Note: orchestrator logs already show the bazar flag for each item.
    // We will look at the allProducts array before it goes to distribution.

    // For this diagnostic, we'll mock a few products if real ones are hard to get quickly,
    // but the best is to see why real ones weren't picked.

    const mockProducts = [
        { id: '123', nome: 'Bazar Product', loja: 'farm', bazar: true, isBazar: true },
        { id: '456', nome: 'Regular Product', loja: 'farm', bazar: false, isBazar: false },
        { id: '789', nome: 'Bazar Dress', loja: 'dressto', bazar: true, isBazar: true }
    ];

    console.log('\n--- Testing Distribution with Mock Data ---');
    const result = distributeLinks(mockProducts, { farm: 7, dressto: 2 }, { stores: { farm: 56, dressto: 22 } });
    console.log('Selected items:', result.map(p => `${p.nome} (Bazar: ${p.bazar})`));

    if (result.some(p => p.bazar)) {
        console.log('✅ Bazar items are correctly prioritized in mock test.');
    } else {
        console.log('❌ Bazar items were NOT prioritized in mock test.');
    }
}

debugBazarSelection();
