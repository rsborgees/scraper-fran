
const axios = require('axios');

async function debugVtexId(id) {
    const baseUrl = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search';

    const attempts = [
        { name: 'Full Text (ft)', params: `?ft=${id}` },
        { name: 'Product Reference (fq)', params: `?fq=productReference:${id}` },
        { name: 'Product ID (fq)', params: `?fq=productId:${id}` },
        { name: 'SKU ID (fq)', params: `?fq=skuId:${id}` }
    ];

    console.log(`\n🔍 Debugging ID: ${id}`);

    for (const attempt of attempts) {
        try {
            const url = baseUrl + attempt.params;
            console.log(`   📡 Testing ${attempt.name}: ${url}`);
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });

            if (response.data && response.data.length > 0) {
                console.log(`      ✅ Found! Name: ${response.data[0].productName}`);
                return;
            } else {
                console.log(`      ⚠️ Not found.`);
            }
        } catch (error) {
            console.log(`      ❌ Error: ${error.message}`);
        }
    }
    console.log(`\n❌ ID ${id} was not found in any common VTEX lookup.`);
}

const targetIds = ['357261', '357698', '356335', '355670'];

async function runDebug() {
    for (const id of targetIds) {
        await debugVtexId(id);
    }
}

runDebug();
