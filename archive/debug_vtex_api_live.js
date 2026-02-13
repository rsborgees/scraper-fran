const axios = require('axios');
const fs = require('fs');

async function testVtexApi() {
    console.log('🧪 TESTANDO API VTEX LIVE (Bypass 403)...');

    const query = 'macaquinho bermuda bynature preto';
    const encodedQuery = encodeURIComponent(query);

    // Endpoint oficial da VTEX para busca (geralmente mais leve que carregar o HTML)
    // Tentar formato padrao VTEX: /api/catalog_system/pub/products/search?_from=0&_to=49&ft={termo}
    const url = `https://www.liveoficial.com.br/api/catalog_system/pub/products/search?_from=0&_to=9&ft=${encodedQuery}`;

    console.log(`\n🔗 URL: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.liveoficial.com.br/'
            },
            timeout: 10000
        });

        console.log(`\n✅ STATUS: ${response.status}`);
        console.log(`📊 Itens encontrados: ${response.data.length}`);

        if (response.data.length > 0) {
            const item = response.data[0];
            console.log('\n📦 Primeiro Item:');
            console.log(`   Nome: ${item.productName}`);
            console.log(`   ID: ${item.productId}`);
            console.log(`   Link: ${item.link}`);

            if (item.items && item.items.length > 0) {
                const sku = item.items[0];
                console.log(`   Preço: R$ ${sku.sellers[0].commertialOffer.Price}`);
                console.log(`   Disponível: ${sku.sellers[0].commertialOffer.AvailableQuantity > 0}`);
            }
        }

    } catch (error) {
        console.log(`\n❌ ERRO: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
        }
    }
}

testVtexApi();
