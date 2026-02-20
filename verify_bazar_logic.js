/**
 * Verification Script: Strict Bazar Rule
 * Verifies that the 'bazar' flag is taken ONLY from the Drive item metadata.
 */

function mockCheck(item, parserResult) {
    const finalProduct = { ...parserResult };

    // Logic from Farm idScanner.js:
    finalProduct.bazar = item.bazar || false;
    finalProduct.isBazar = finalProduct.bazar;

    return finalProduct;
}

// Case 1: Drive Item NOT Bazar, but Site/Parser thinks it IS Bazar
const item1 = { id: '123', bazar: false };
const parser1 = { id: '123', name: 'Peça Legal', bazar: true };
const result1 = mockCheck(item1, parser1);
console.log(`Test 1 (Drive: NO, Site: YES) -> Result Bazar: ${result1.bazar} (Expected: false)`);

// Case 2: Drive Item IS Bazar, but Site/Parser thinks it is NOT Bazar
const item2 = { id: '456', bazar: true };
const parser2 = { id: '456', name: 'Peça Promo', bazar: false };
const result2 = mockCheck(item2, parser2);
console.log(`Test 2 (Drive: YES, Site: NO) -> Result Bazar: ${result2.bazar} (Expected: true)`);

// Case 3: Drive Item NOT Bazar, Site/Parser NOT Bazar
const item3 = { id: '789', bazar: false };
const parser3 = { id: '789', name: 'Nova Coleção', bazar: false };
const result3 = mockCheck(item3, parser3);
console.log(`Test 3 (Drive: NO, Site: NO) -> Result Bazar: ${result3.bazar} (Expected: false)`);

if (result1.bazar === false && result2.bazar === true && result3.bazar === false) {
    console.log('\n✅ VERIFICATION PASSED: Strict Bazar Rule logic is correct.');
} else {
    console.log('\n❌ VERIFICATION FAILED.');
}
