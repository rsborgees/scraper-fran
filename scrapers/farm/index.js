const { initBrowser } = require('../../browser_setup');
const fs = require('fs');
const path = require('path');
const { processProductUrl } = require('../../imageDownloader');

/**
 * Scraper FARM - Isolado
 * Quota: 84 produtos
 * @param {number} quota - Número máximo de produtos a retornar
 */
async function scrapeFarm(quota = 84) {
    console.log('\n🌸 INICIANDO SCRAPER FARM (Quota: ' + quota + ')');

    const CATEGORIES = [
        { name: 'Vestidos', url: 'https://www.farmrio.com.br/vestido' },
        { name: 'Macacões', url: 'https://www.farmrio.com.br/macacao' },
        { name: 'Saias', url: 'https://www.farmrio.com.br/saia' },
        { name: 'Shorts', url: 'https://www.farmrio.com.br/short' },
        { name: 'Blusas', url: 'https://www.farmrio.com.br/blusa' },
        { name: 'Camisas', url: 'https://www.farmrio.com.br/camisa' },
        { name: 'Bazar', url: 'https://www.farmrio.com.br/bazar' },
        { name: 'Praia', url: 'https://www.farmrio.com.br/praia' }
    ];

    const confirmedPromotions = [];

    // Importa funções auxiliares locais
    const { scanCategory } = require('./scanner');
    const { parseProduct } = require('./parser');

    for (const cat of CATEGORIES) {
        if (confirmedPromotions.length >= quota) break;

        console.log(`\n📂 Processando Categoria: ${cat.name}`);
        const candidates = await scanCategory(cat.url, cat.name);

        if (candidates.length === 0) {
            console.log(`  -> Nenhum candidato encontrado em ${cat.name}.`);
            continue;
        }

        for (const url of candidates) {
            if (confirmedPromotions.length >= quota) break;

            // 1. Image Download Integration
            console.log(`🖼️  Baixando imagem...`);
            let imagePath = null;
            try {
                const imgResult = await processProductUrl(url);
                if (imgResult.status === 'success' && imgResult.path.length > 0) {
                    imagePath = imgResult.path[0];
                    console.log(`   ✔️  Imagem salva: ${imagePath}`);
                } else {
                    console.log(`   ⚠️  Falha download imagem: ${imgResult.reason}`);
                }
            } catch (err) {
                console.log(`   ❌ Erro download imagem: ${err.message}`);
            }

            const product = await parseProduct(url);
            if (product) {
                // Adiciona campo 'loja' e 'desconto'
                product.loja = 'farm';
                product.desconto = product.precoOriginal - product.precoAtual;
                product.imagePath = imagePath;
                confirmedPromotions.push(product);
            }
        }
    }

    // Deduplicação
    const uniquePromotions = [];
    const seenUrls = new Set();

    confirmedPromotions.forEach(product => {
        if (!seenUrls.has(product.url)) {
            seenUrls.add(product.url);
            uniquePromotions.push(product);
        }
    });

    // Aplicar cotas internas (65% vestido, 15% macacão, etc)
    const quotas = {
        'vestido': Math.floor(quota * 0.65),
        'macacão': Math.floor(quota * 0.15),
        'saia': Math.floor(quota * 0.05),
        'short': Math.floor(quota * 0.05),
        'blusa': Math.floor(quota * 0.05),
        'acessório': Math.floor(quota * 0.05)
    };

    const byCategory = {};
    uniquePromotions.forEach(p => {
        const cat = p.categoria || 'outros';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(p);
    });

    const selectedProducts = [];
    Object.keys(quotas).forEach(cat => {
        const available = byCategory[cat] || [];
        const catQuota = quotas[cat];
        const selected = available.slice(0, catQuota);
        selectedProducts.push(...selected);
    });

    console.log(`\n✅ FARM: ${selectedProducts.length}/${quota} produtos capturados`);

    if (selectedProducts.length < quota) {
        console.warn(`⚠️ quota_not_reached: FARM (${selectedProducts.length}/${quota})`);
    }

    return selectedProducts;
}

module.exports = { scrapeFarm };
