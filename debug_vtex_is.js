const axios = require('axios');

async function testVtexIntelligentSearch() {
    console.log('🧪 TESTANDO API VTEX INTELLIGENT SEARCH (Live)...');

    const query = 'macaquinho bermuda bynature preto';
    const encodedQuery = encodeURIComponent(query);

    // Endpoint comum em lojas VTEX IO (que a Live parece ser)
    const url = `https://www.liveoficial.com.br/api/io/_v/api/intelligent-search/product_search?query=${encodedQuery}&count=10&simulation=true`;

    console.log(`\n🔗 URL: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.liveoficial.com.br/'
            },
            timeout: 15000
        });

        console.log(`\n✅ STATUS: ${response.status}`);
        // console.log(`📦 Headers: ${JSON.stringify(response.headers)}`);

        const products = response.data.products || [];
        console.log(`📊 Itens encontrados: ${products.length}`);

        if (products.length > 0) {
            const item = products[0];
            console.log('\n📦 Primeiro Item (API):');
            console.log(`   Nome: ${item.productName}`);
            console.log(`   ID: ${item.productId}`);
            console.log(`   Link: ${item.link}`); // Link relativo

            if (item.items && item.items.length > 0) {
                const sku = item.items[0];
                const commertialOffer = sku.sellers[0]?.commertialOffer;
                console.log(`   Preço: R$ ${commertialOffer?.Price}`);
            }
        } else {
            console.log('   ⚠️ Nenhum produto retornado na busca.');
            console.log('   Data:', JSON.stringify(response.data).substring(0, 500));
        }

    } catch (error) {
        console.log(`\n❌ ERRO: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data)}`);
        }
    }
}

testVtexIntelligentSearch();
