const axios = require('axios');

const ids = [
    '358001',
    '356090',
    '355078',
    '356023',
    '356094',
    '356024',
    '358356',
    '358015'
];

async function checkIds() {
    console.log('🔍 Checking IDs on Farm VTEX API...\n');

    for (const id of ids) {
        const url = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (response.data && response.data.length > 0) {
                const product = response.data[0];
                const isAvailable = product.items.some(item =>
                    item.sellers.some(seller => seller.commertialOffer.AvailableQuantity > 0)
                );

                console.log(`✅ ID ${id}: FOUND`);
                console.log(`   Name: ${product.productName}`);
                console.log(`   Available: ${isAvailable ? 'YES' : 'NO'}`);
                console.log(`   Link: ${product.link}`);
            } else {
                console.log(`❌ ID ${id}: NOT FOUND in API Search`);
            }
        } catch (error) {
            console.log(`err ID ${id}: Error - ${error.message}`);
        }
    }
}

checkIds();
