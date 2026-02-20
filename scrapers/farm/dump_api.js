const axios = require('axios');

async function dumpNovidades() {
    const url = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search?O=OrderByReleaseDateDESC&_from=0&_to=4';
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        response.data.forEach(p => {
            console.log(`\n--- ${p.productName} ---`);
            p.items.slice(0, 1).forEach(itm => {
                console.log(`Variations structure:`, JSON.stringify(itm.variations, null, 2));
                // Also check itm.Tamanho
                console.log(`itm.Tamanho:`, itm.Tamanho);
            });
        });

    } catch (e) {
        console.error(e.message);
    }
}

dumpNovidades();
