const axios = require('axios');

async function check() {
    const id = '355028';
    const url = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        if (response.data && response.data.length > 0) {
            const p = response.data[0];
            console.log('Product Name:', p.productName);
            console.log('Categories:', JSON.stringify(p.categories, null, 2));
            console.log('Category Selection Text (simulated):', (p.link.toLowerCase() + ' ' + p.productName.toLowerCase() + ' ' + (p.categories || []).join(' ').toLowerCase()));
        } else {
            console.log('Product not found');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

check();
