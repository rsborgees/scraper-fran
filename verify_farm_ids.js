const axios = require('axios');

function fastParseFromApi(productData) {
    if (!productData) return { error: 'Dados da API vazios' };

    const name = productData.productName;
    const urlLower = (productData.link || '').toLowerCase();
    if (!urlLower) return { error: 'Link vazio' };
    const nameLower = name.toLowerCase();

    // 1. FILTRO ANTI-INFANTIL
    if (/fabula|bento|teen|kids|infantil|brincando/i.test(urlLower) || /bento|fábula|fabula/i.test(nameLower)) {
        return { error: 'Produto Infantil detectado' };
    }

    // 2. CHECK BAZAR
    const isBazar = urlLower.includes('bazar') || nameLower.includes('bazar');
    if (isBazar) return { error: 'Produto de Bazar bloqueado' };

    // 3. CATEGORIA
    let category = 'desconhecido';
    const categories = productData.categories || [];
    const breadcrumbText = categories.join(' ').toLowerCase();
    const strictText = (urlLower + ' ' + nameLower + ' ' + breadcrumbText);

    if (strictText.includes('/vestido') || strictText.includes('vestido')) category = 'vestido';
    else if (strictText.includes('/macacao') || strictText.includes('/macaquinho') || strictText.includes('macacão') || strictText.includes('macaquinho')) category = 'macacão';
    else if (strictText.includes('/conjunto') || strictText.includes('conjunto')) category = 'conjunto';
    else if (strictText.includes('/saia') || strictText.includes('saia')) category = 'saia';
    else if (strictText.includes('/short') || strictText.includes('short')) category = 'short';
    else if (strictText.includes('/calca') || strictText.includes('calça')) category = 'calça';
    else if (strictText.includes('/blusa') || strictText.includes('/camisa') || strictText.includes('/t-shirt') || strictText.includes('blusa') || strictText.includes('camisa') || strictText.includes('t-shirt')) category = 'blusa';
    else if (strictText.includes('/casaco') || strictText.includes('/jaqueta') || strictText.includes('/moletom') || strictText.includes('casaco') || strictText.includes('jaqueta') || strictText.includes('moletom')) category = 'casaco';
    else if (strictText.includes('/body') || strictText.includes('/kimono') || strictText.includes('/top') || strictText.includes('body') || strictText.includes('kimono') || strictText.includes('top')) category = 'top/body';
    else if (strictText.includes('/biquini') || strictText.includes('/maio') || strictText.includes('biquíni') || strictText.includes('maiô') || strictText.includes('biquini') || strictText.includes('maio')) category = 'banho';

    if (category === 'desconhecido') {
        return { error: 'Categoria não identificada (Bloqueio Preventivo)' };
    }

    // 4. PREÇOS E DISPONIBILIDADE
    const items = productData.items || [];
    const validSizes = [];

    items.forEach(item => {
        const seller = item.sellers && item.sellers[0];
        if (!seller || !seller.commertialOffer) return;

        const offer = seller.commertialOffer;
        if (offer.AvailableQuantity > 0) {
            let size = item.name.toUpperCase().trim();
            if (size.includes(' - ')) {
                const parts = size.split(' - ');
                size = parts[parts.length - 1].trim();
            }
            if (/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i.test(size)) {
                validSizes.push(size);
            }
        }
    });

    if (validSizes.length === 0) {
        return { error: `Produto ESGOTADO (Sem tamanhos disponíveis para ${category})` };
    }

    return { data: { category, validSizes } };
}

async function verifyIds() {
    const ids = ['357261', '356102', '359376', '357989', '352169', '354932', '352151', '351500', '354405', '352422'];

    for (const id of ids) {
        console.log(`\n🔍 Verificando ID ${id}...`);
        try {
            // Tentativa 1: ft (Full Text)
            const apis = [
                { name: 'ft', url: `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}` },
                { name: 'refId', url: `https://www.farmrio.com.br/api/catalog_system/pub/products/search?fq=alternativeId_RefId:${id}` },
                { name: 'productId', url: `https://www.farmrio.com.br/api/catalog_system/pub/products/search?fq=productId:${id}` }
            ];

            let found = false;
            for (const api of apis) {
                const response = await axios.get(api.url, { timeout: 10000 });
                if (response.data && response.data.length > 0) {
                    const productData = response.data[0];
                    console.log(`   ✅ Encontrado via [${api.name}]: ${productData.productName}`);

                    const fastResult = fastParseFromApi(productData);
                    if (fastResult.error) {
                        console.log(`   🚫 Bloqueado por fastParse: ${fastResult.error}`);
                    } else {
                        console.log(`   🎉 Aceito! Categoria: ${fastResult.data.category}, Tamanhos: ${fastResult.data.validSizes.join(', ')}`);
                    }
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log(`   ❌ Não encontrado em NENHUMA API.`);
            }
        } catch (e) {
            console.error(`   ❌ Erro ao acessar a API: ${e.message}`);
        }
    }
}

verifyIds();
