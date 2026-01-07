const { initBrowser } = require('../../browser_setup');
const fs = require('fs');
const path = require('path');
const { processProductUrl, processImageDirect } = require('../../imageDownloader');
const { checkFarmTimer } = require('./timer_check');
const { isDuplicate, markAsSent } = require('../../historyManager');

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
        { name: 'Acessórios', url: 'https://www.farmrio.com.br/acessorios' },
        { name: 'Praia', url: 'https://www.farmrio.com.br/praia' }
    ];

    // Verifica Timer/Cupom Global
    console.log('⏳ Verificando status do reloginho/cupom...');
    let timerData = null;
    try {
        timerData = await checkFarmTimer();
    } catch (e) { console.error('Error checking timer:', e); }

    const confirmedPromotions = [];
    const seenInRun = new Set();

    // Importa funções auxiliares locais
    const { scanCategory } = require('./scanner');
    const { parseProduct } = require('./parser');

    const { normalizeId } = require('../../historyManager');

    for (const cat of CATEGORIES) {
        if (confirmedPromotions.length >= (quota * 10)) break; // PRECISA DE MARGEM ENORME pois filtro 40% descarta 90% dos itens

        console.log(`\n📂 Processando Categoria: ${cat.name}`);
        const candidates = await scanCategory(cat.url, cat.name);

        for (const url of candidates) {
            // Extração precoce de ID para evitar processamento de duplicados
            const idMatch = url.match(/(\d{5,})/);
            const earlyId = idMatch ? idMatch[1].substring(0, 6) : null;
            const normEarlyId = normalizeId(earlyId);

            if (normEarlyId && (seenInRun.has(normEarlyId) || isDuplicate(normEarlyId))) {
                console.log(`   ⏭️  Pulo (Match ID precoce): ${normEarlyId}`);
                continue;
            }

            // 1. Parse Product PRIMEIRO para garantir que estamos na página certa e ter o ID
            const product = await parseProduct(url);

            if (product) {
                const normId = normalizeId(product.id);
                // Se o parser extraiu um ID diferente ou mais preciso, re-checa
                if (seenInRun.has(normId) || isDuplicate(normId)) {
                    console.log(`   ⏭️  Duplicado (Histórico/Run): ${normId}`);
                    continue;
                }

                seenInRun.add(normId);
                markAsSent([product.id]); // MARCA IMEDIATAMENTE NO HISTÓRICO


                // 2. Image Download Integration
                console.log(`\n🖼️  Baixando imagem com ID: ${product.id}...`);
                let imagePath = null;
                try {
                    // OTIMIZAÇÃO
                    let imgResult;
                    if (product.imageUrl) {
                        imgResult = await processImageDirect(product.imageUrl, 'FARM', product.id);
                    } else {
                        imgResult = await processProductUrl(url, product.id);
                    }

                    if (imgResult.status === 'success' && imgResult.cloudinary_urls && imgResult.cloudinary_urls.length > 0) {
                        imagePath = imgResult.cloudinary_urls[0];
                        console.log(`   ✔️  Imagem salva: ${imagePath}`);
                    } else {
                        console.log(`   ⚠️  Falha download imagem: ${imgResult.reason}`);
                    }
                } catch (err) {
                    console.log(`   ❌ Erro download imagem: ${err.message}`);
                }

                // Adiciona parâmetros de vendedora na URL de forma robusta
                // Isso garante que o link tenha o código mesmo se não usar a mensagem formatada
                const { appendQueryParams } = require('../../urlUtils');
                product.url = appendQueryParams(url, {
                    utm_campaign: "7B1313"
                });

                // Adiciona campo 'loja' e 'desconto'
                // Adiciona informações extras para o MessageBuilder
                product.loja = 'farm';
                product.desconto = product.precoOriginal - product.precoAtual;
                product.imagePath = imagePath;
                product.timerData = timerData;

                confirmedPromotions.push(product);
            }
        }
    }


    // Deduplicação FINAL por ID e Ordenação por Prioridade (Promoção Primeiro)
    const uniquePromotions = [];
    const seenFinalIds = new Set();

    // Ordena por maior desconto primeiro (percentual ou absoluto)
    confirmedPromotions.sort((a, b) => {
        const descA = a.precoOriginal - a.precoAtual;
        const descB = b.precoOriginal - b.precoAtual;
        return descB - descA; // Maior desconto primeiro
    });

    confirmedPromotions.forEach(product => {
        const normId = normalizeId(product.id);
        if (!seenFinalIds.has(normId)) {
            seenFinalIds.add(normId);
            uniquePromotions.push(product);
        }
    });

    // Aplicar cotas internas (65% vestido, 15% macacão, etc)
    const quotas = {
        'vestido': Math.round(quota * 0.65),
        'macacão': Math.round(quota * 0.15),
        'saia': Math.round(quota * 0.05),
        'short': Math.round(quota * 0.05),
        'blusa': Math.round(quota * 0.05),
        'acessório': Math.round(quota * 0.05)
    };

    // Ajuste fino para garantir que a soma das cotas seja igual à quota total
    let totalQuotas = Object.values(quotas).reduce((a, b) => a + b, 0);
    if (totalQuotas < quota) quotas['vestido'] += (quota - totalQuotas);
    if (totalQuotas > quota) quotas['vestido'] -= (totalQuotas - quota);

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

    // Se ainda não atingiu a quota total (por falta de produtos em categorias específicas)
    // Preenche com o que sobrar de outras categorias (já ordenadas por prioridade de desconto)
    if (selectedProducts.length < quota) {
        const remainingQuota = quota - selectedProducts.length;
        const alreadySelectedIds = new Set(selectedProducts.map(p => normalizeId(p.id)));
        const pool = uniquePromotions.filter(p => !alreadySelectedIds.has(normalizeId(p.id)));
        selectedProducts.push(...pool.slice(0, remainingQuota));
    }

    console.log(`\n✅ FARM: ${selectedProducts.length}/${quota} produtos capturados (Promos leves + Preço Cheio)`);

    // markAsSent já foi chamado para cada produto aceito


    if (selectedProducts.length < quota) {
        console.warn(`⚠️ quota_not_reached: FARM (${selectedProducts.length}/${quota})`);
    }

    return selectedProducts;
}

module.exports = { scrapeFarm };
