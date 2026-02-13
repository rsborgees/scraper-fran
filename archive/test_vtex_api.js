const axios = require('axios');
const fs = require('fs');

async function testVtexApi() {
    const productId = '355668';
    const url = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?fq=productId:${productId}`;
    console.log(`🌐 Testando VTEX API: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        console.log(`✅ Status: ${response.status}`);
        console.log('📦 Data snippet:', JSON.stringify(response.data, null, 2).substring(0, 500));

        if (response.data && response.data.length > 0) {
            fs.writeFileSync('vtex_product_api.json', JSON.stringify(response.data, null, 2));
            console.log('✅ Dados salvos em vtex_product_api.json');
        } else {
            console.log('❌ Nenhum dado retornado pela API.');
        }

    } catch (err) {
        console.error('❌ Erro na API:', err.message);
        if (err.response) {
            console.error('📊 Response:', err.response.status, err.response.data);
        }
    }
}

testVtexApi();
