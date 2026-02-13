const axios = require('axios');

async function findForbidden() {
    const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=bolsa`;
    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const products = response.data;
        if (products.length > 0) {
            console.log(`Found forbidden product: ${products[0].productName} (Ref: ${products[0].productReference})`);
            console.log(`Target ID: ${products[0].productReference}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

findForbidden();
