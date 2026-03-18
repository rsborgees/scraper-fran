/**
 * Script: send_20_normal_farm.js
 * Pega 20 itens normais da Farm do Drive, busca dados no VTEX,
 * usa a imagem do Drive (não do site) e envia pro webhook.
 */
require('dotenv').config();
const axios = require('axios');
const { getExistingIdsFromDrive } = require('./driveManager');
const { buildFarmMessage } = require('./messageBuilder');
const { isDuplicate, normalizeId, markAsSent, loadHistory } = require('./historyManager');
const { processImageDirect } = require('./imageDownloader');
const { appendQueryParams } = require('./urlUtils');

const WEBHOOK_URL = 'https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const TARGET = 20;
const FARM_API = 'https://www.farmrio.com.br/api/catalog_system/pub/products/search';

// Extrai tamanhos disponíveis de forma limpa (só o label, ex: "M", "G")
function getAvailableSizes(p) {
    const seen = new Set();
    const sizes = [];
    for (const sku of (p.items || [])) {
        const available = (sku.sellers || []).some(
            s => s.commertialOffer?.IsAvailable && s.commertialOffer?.AvailableQuantity > 0
        );
        if (available) {
            const parts = sku.name.split(' - ');
            const size = parts[parts.length - 1]?.trim();
            if (size && !seen.has(size)) {
                seen.add(size);
                sizes.push(size);
            }
        }
    }
    return sizes;
}

function isOnlyExtreme(sizes) {
    if (sizes.length === 0) return true;
    if (sizes.length > 1) return false;
    const s = sizes[0].split(' - ').pop()?.trim().toUpperCase();
    return ['PP', 'GG', 'EG', 'XGG', 'EXG'].includes(s);
}

(async () => {
    console.log(`\n🌾 Buscando ${TARGET} itens normais da Farm (Drive-Only)...\n`);

    // 1. Carregar itens do Drive
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const allDriveItems = await getExistingIdsFromDrive(folderId);

    const normals = allDriveItems.filter(i =>
        i.store === 'farm' &&
        !i.bazar && !i.isBazar &&
        !i.isFavorito && !i.favorito &&
        !i.novidade && !i.isNovidade
    );
    console.log(`📦 ${normals.length} itens normais no Drive`);

    // Prioriza nunca enviados, depois mais antigos
    const history = loadHistory();
    normals.forEach(i => {
        const entry = history[normalizeId(i.id)];
        i._lastSent = entry ? entry.timestamp : 0;
    });
    normals.sort((a, b) => a._lastSent - b._lastSent);

    // 2. Processar candidatos: buscar dados VTEX e filtrar por disponibilidade
    const results = [];
    const seen = new Set();
    let attempted = 0;

    for (const driveItem of normals) {
        if (results.length >= TARGET) break;

        const id = driveItem.id;
        const normId = normalizeId(id);
        if (seen.has(normId)) continue;
        if (isDuplicate(normId, { maxAgeHours: 48 })) continue;
        seen.add(normId);
        attempted++;

        try {
            const res = await axios.get(FARM_API, {
                params: { ft: id, sc: 1 },
                headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
                timeout: 8000
            });
            const matches = (res.data || []).filter(p =>
                String(p.productReference) === id || String(p.productId) === id
            );
            if (matches.length === 0) {
                // Tenta qualquer resultado da busca que contenha o ID no linkText
                const byLink = (res.data || []).find(p => p.linkText?.includes(id));
                if (!byLink) {
                    console.log(`  ⚠️ [${attempted}] ${id} — não encontrado na API`);
                    continue;
                }
                matches.push(byLink);
            }

            const p = matches[0];
            const sizes = getAvailableSizes(p);
            if (isOnlyExtreme(sizes)) {
                console.log(`  ❌ [${attempted}] ${p.productName} — tamanho extremo (${sizes.join(', ')})`);
                continue;
            }

            const preco = p.items?.[0]?.sellers?.[0]?.commertialOffer?.Price || 0;
            const precoOriginal = p.items?.[0]?.sellers?.[0]?.commertialOffer?.ListPrice || preco;
            const productUrl = `https://www.farmrio.com.br/${p.linkText}/p`;

            const product = {
                id: id,
                driveId: driveItem.driveId,
                nome: p.productName,
                loja: 'farm',
                preco,
                precoAtual: preco,
                precoOriginal,
                categoria: 'vestido',
                tamanhos: sizes,
                imageUrl: driveItem.driveUrl, // 🔑 imagem do Drive, não do site
                url: appendQueryParams(productUrl, { utm_campaign: '7B1313' }),
                imagePath: 'error.jpg',
                bazar: false,
                isBazar: false,
                timerData: null,
            };

            // Upload da imagem do Drive → Cloudinary
            try {
                const imgResult = await processImageDirect(driveItem.driveUrl, 'FARM', id);
                if (imgResult?.cloudinary_urls?.length > 0) {
                    product.imagePath = imgResult.cloudinary_urls[0];
                    console.log(`    🖼️  Imagem Drive → Cloudinary OK`);
                }
            } catch (e) {
                console.warn(`    ⚠️  Imagem Drive falhou: ${e.message}`);
            }

            product.message = buildFarmMessage(product, null);
            markAsSent(normId, preco);
            results.push(product);
            console.log(`  ✅ [${results.length}/${TARGET}] ${product.nome} (${id}) — ${sizes.join(', ')} — R$${preco}`);

        } catch (e) {
            console.log(`  ⚠️ [${attempted}] ${id} — erro: ${e.response?.status || e.message}`);
        }

        // Pequeno delay para não sobrecarregar a API
        if (attempted % 5 === 0) await new Promise(r => setTimeout(r, 500));
    }

    if (results.length === 0) {
        console.log('\n⚠️ Nenhum produto capturado. Encerrando.');
        return;
    }

    console.log(`\n📤 Enviando ${results.length} produtos pro webhook...`);
    const payload = {
        timestamp: new Date().toISOString(),
        totalProducts: results.length,
        products: results,
        summary: { farm: results.length }
    };

    const res = await axios.post(WEBHOOK_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
    });
    console.log(`✅ Enviado! Status: ${res.status}`);
    console.log(`   Total tentativas: ${attempted} | Resultado: ${results.length}/${TARGET}`);
})().catch(e => {
    console.error('❌ Erro:', e.message);
    process.exit(1);
});
