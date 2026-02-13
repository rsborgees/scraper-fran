const axios = require('axios');
const fs = require('fs');

async function testVtexNewArrivals() {
    const url = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search?O=OrderByReleaseDateDESC&_from=0&_to=20';
    console.log(`🌐 Testando VTEX New Arrivals: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        console.log(`✅ Status: ${response.status}`);

        if (response.data && response.data.length > 0) {
            console.log(`📦 Produtos encontrados: ${response.data.length}`);
            fs.writeFileSync('vtex_new_arrivals.json', JSON.stringify(response.data, null, 2));

            // Ver se algum dos meus "NOVO!" candidatos está aqui
            const candidateIds = ['355668', '356100', '357955', '357164'];
            const foundIds = response.data.map(p => p.productReference);

            candidateIds.forEach(id => {
                if (foundIds.includes(id)) {
                    console.log(`🎯 Candidato ${id} ENCONTRADO na API!`);
                }
            });

        } else {
            console.log('❌ Nenhum dado retornado pela API.');
        }

    } catch (err) {
        console.error('❌ Erro na API:', err.message);
    }
}

testVtexNewArrivals();
