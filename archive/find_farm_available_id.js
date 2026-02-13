const axios = require('axios');

async function findAvailable() {
    const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?O=OrderByReleaseDateDESC`;
    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const products = response.data;
        for (const p of products) {
            const hasStock = p.items.some(item => item.sellers[0].commertialOffer.AvailableQuantity > 0);
            if (hasStock) {
                console.log(`Found available product: ${p.productName} (Ref: ${p.productReference})`);
                const availableSizes = p.items
                    .filter(item => item.sellers[0].commertialOffer.AvailableQuantity > 0)
                    .map(item => item.name);
                console.log(`Available sizes: ${availableSizes.join(', ')}`);

                // Check if it's a clothing category
                const catStr = p.categories.join(' ').toLowerCase();
                if (catStr.includes('vestido') || catStr.includes('blusa') || catStr.includes('calça')) {
                    console.log(`Target ID: ${p.productReference}`);
                    return;
                }
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

findAvailable();
