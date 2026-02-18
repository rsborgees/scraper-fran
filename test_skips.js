
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');
const { isDuplicate, normalizeId, loadHistory } = require('./historyManager');

// Mock of fastParseFromApi to see what would be blocked
function fastParseFromApi(productData, isFavorito = false, isNovidade = false) {
    if (!productData) return { error: 'Dados da API vazios' };

    const name = productData.productName;
    const urlLower = (productData.link || '').toLowerCase();
    const nameLower = name.toLowerCase();

    // 1. FILTRO ANTI-INFANTIL
    if (/fabula|bento|teen|kids|infantil|brincando/i.test(urlLower) || /bento|fábula|fabula/i.test(nameLower)) {
        return { error: 'Produto Infantil detectado' };
    }

    // 2. CATEGORIA
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
        const isForbidden = (function () {
            if (/\/mala(-|\/)/i.test(strictText) || /\bmala\b/i.test(strictText)) return 'mala';
            if (/mochila/i.test(strictText) || /rodinha/i.test(strictText)) return 'mala';
            if (/\/brinco-/i.test(strictText) || /\/bolsa(-|\/|\?)/i.test(strictText) || /\bbolsa\b/i.test(strictText) || /\/colar-/i.test(strictText) || /\/cinto-/i.test(strictText)) return 'acessório';
            if (/\/garrafa-/i.test(strictText) || /\/copo-/i.test(strictText)) return 'utilitário';
            return null;
        })();
        if (isForbidden) return { error: `${isForbidden} bloqueado` };

        // Se for Favorito, permitimos "desconhecido"
        if (isFavorito) {
            category = 'outro';
        } else {
            return { error: 'Categoria não identificada (Bloqueio Preventivo)' };
        }
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
            if (size.includes(' - ')) size = size.split(' - ').pop().trim();
            if (/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i.test(size)) {
                validSizes.push(size);
            }
        }
    });

    if (validSizes.length === 0) {
        return { error: `Produto ESGOTADO (Sem tamanhos disponíveis para ${category})` };
    }

    return { success: true, category };
}

async function start() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const allDriveItems = await getExistingIdsFromDrive(folderId);
    const targetItems = allDriveItems.filter(item => item.isFavorito || item.novidade);
    const farmItems = targetItems.filter(i => i.store === 'farm');

    console.log(`\n🔍 Analisando ${farmItems.length} itens da FARM...`);

    const axios = require('axios');
    for (const item of farmItems.slice(0, 20)) {
        console.log(`\nChecking ${item.id} (${item.isFavorito ? 'FAV' : ''} ${item.novidade ? 'NOV' : ''})...`);

        // 1. Check Duplicate
        const isDup = isDuplicate(normalizeId(item.id), { force: item.isFavorito, maxAgeHours: 48 });
        if (isDup) {
            console.log(`   ⏭️  Pulado por Duplicidade (Rule: 48h, Force: ${item.isFavorito})`);
        }

        // 2. Check API / Category
        try {
            const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${item.id}`;
            const response = await axios.get(apiUrl);
            const json = response.data;

            if (json && json.length > 0) {
                const productData = json[0];
                const res = fastParseFromApi(productData, item.isFavorito, item.novidade);
                if (res.error) {
                    console.log(`   ❌ Bloqueado pela API/Categoria: ${res.error}`);
                } else {
                    console.log(`   ✅ OK para envio! Categoria: ${res.category}`);
                }
            } else {
                console.log(`   ⚠️ Não encontrado na API.`);
            }
        } catch (e) {
            console.log(`   ❌ Erro ao consultar API: ${e.message}`);
        }
    }
}

start();
