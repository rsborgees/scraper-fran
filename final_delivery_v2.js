const axios = require('axios');
const fs = require('fs');
require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function finalSend() {
    console.log('🚀 Iniciando processamento final via VTEX API Cache...');

    try {
        const rawData = fs.readFileSync('vtex_new_arrivals.json', 'utf-8');
        const products = JSON.parse(rawData);

        const driveItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
        const driveBaseIds = driveItems.map(item => item.id);

        const finalCandidates = [];

        for (const p of products) {
            if (finalCandidates.length >= 2) break;

            const fullId = p.productReference; // 326481_0024
            const baseId = fullId.split('_')[0]; // 326481

            if (driveBaseIds.includes(baseId)) {
                console.log(`⏭️ Ignorando ${baseId} (Já no Drive)`);
                continue;
            }

            // Verificar se é roupa (excluir acessórios)
            const catPath = p.categories ? p.categories.join(' ').toLowerCase() : '';
            const name = p.productName.toLowerCase();
            const url = p.link.toLowerCase();

            const isAcessorio = /brinco|bolsa|colar|cinto|acessorio|culos|garrafa|copo|chaveiro|necessaire|pochete|carteira/.test(catPath + ' ' + name + ' ' + url);

            if (isAcessorio) {
                console.log(`⏭️ Ignorando ${baseId} (Acessório detectado: ${p.productName})`);
                continue;
            }

            // Verificar estoque e tamanhos
            const item = p.items[0];
            const stock = item.sellers[0].commertialOffer.AvailableQuantity;

            if (stock === 0) {
                console.log(`⏭️ Ignorando ${baseId} (Sem estoque)`);
                continue;
            }

            // Tamanhos
            const sizes = item.variations?.find(v => v.name === 'Tamanho')?.values || [];

            // Filtro de tamanhos: Rejeitar apenas se houver um único tamanho extremo (PP ou GG)
            const upperSizes = sizes.map(s => s.toUpperCase());
            const isOnlyPP = upperSizes.length === 1 && upperSizes[0] === 'PP';
            const isOnlyGG = upperSizes.length === 1 && upperSizes[0] === 'GG';

            if ((isOnlyPP || isOnlyGG) && sizes.length > 0) {
                console.log(`⏭️ Ignorando ${baseId} (Tamanho extremo único: ${sizes.join(', ')})`);
                continue;
            }

            // Preparar payload
            const productData = {
                name: p.productName,
                id: baseId,
                sku: item.itemId,
                price: item.sellers[0].commertialOffer.Price,
                oldPrice: item.sellers[0].commertialOffer.ListPrice,
                image: item.images[0].imageUrl,
                url: p.link,
                store: 'farm',
                novidade: true,
                isNovidade: true,
                tamanhos: sizes,
                estoque: stock
            };

            finalCandidates.push(productData);
            console.log(`✅ Candidato adicionado: ${p.productName} (${baseId})`);
        }

        if (finalCandidates.length > 0) {
            console.log(`📤 Enviando ${finalCandidates.length} itens para o webhook...`);
            const response = await axios.post(WEBHOOK_URL, finalCandidates);
            console.log(`✅ Webhook disparado! Status: ${response.status}`);
        } else {
            console.log('❌ Nenhum candidato encontrado que atendesse aos critérios.');
        }

    } catch (err) {
        console.error('❌ Erro no processamento final:', err.message);
    }
}

finalSend();
