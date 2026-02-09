const axios = require('axios');

async function checkApi(id) {
    const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;
    try {
        console.log(`Fetching ${apiUrl}...`);
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const data = response.data;
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

const targetId = process.argv[2] || '355026';
checkApi(targetId);
