const axios = require('axios');
const { initBrowser } = require('./browser_setup');
const { parseProductZZMall } = require('./scrapers/zzmall/index');
const { processImageDirect } = require('./imageDownloader');
const { findFileByProductId } = require('./driveManager');
const { buildZzMallMessage } = require('./messageBuilder');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function run() {
    console.log('🚀 Iniciando envio manual ZZMall para Webhook (PADRÃO FRANCALHEIRA)...');

    // Forçamos HEADLESS=true
    process.env.HEADLESS = 'true';
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const { browser, page } = await initBrowser();

    try {
        const url = 'https://www.zzmall.com.br/bolsa-shopping-bege-couro-becca-grande/p/A5001506080001U';

        const product = await parseProductZZMall(page, url);

        if (!product) {
            console.error('❌ Falha ao parsear produto.');
            return;
        }

        console.log('✅ Produto parseado com sucesso:', product.nome);

        // 1. Upload imagem para Cloudinary
        let cloudinaryUrl = null;
        if (product.imageUrl) {
            console.log('🖼️ Enviando imagem para Cloudinary...');
            const imgResult = await processImageDirect(product.imageUrl, 'ZZMALL', product.id);
            if (imgResult.status === 'success' && imgResult.cloudinary_urls.length > 0) {
                cloudinaryUrl = imgResult.cloudinary_urls[0];
                console.log('✅ Imagem no Cloudinary:', cloudinaryUrl);
            }
        }

        // 2. Buscar foto no Google Drive
        let driveUrl = null;
        console.log('📂 Buscando foto no Google Drive...');
        const driveFile = await findFileByProductId(folderId, product.id);
        if (driveFile) {
            driveUrl = driveFile.driveUrl;
            console.log('✅ Foto encontrada no Drive:', driveUrl);
        } else {
            console.log('⚠️ Foto NÃO encontrada no Drive para o ID:', product.id);
        }

        // Criar objeto do produto com todos os campos do padrão
        const fullProduct = {
            ...product,
            id: product.id.replace(/U$/, ''),
            sku: product.id,
            price: product.precoAtual,
            oldPrice: product.precoOriginal || product.precoAtual,
            image: cloudinaryUrl, // Cloudinary
            imageUrl: driveUrl || cloudinaryUrl || product.imageUrl, // Prioridade Drive, senão Cloudinary, senão original
            imagePath: driveUrl || cloudinaryUrl, // Prioridade Drive, senão Cloudinary
            loja: 'zzmall',
            novidade: true,
            isNovidade: true,
            estoque: 99
        };

        // Gerar mensagem padrão
        fullProduct.message = buildZzMallMessage(fullProduct);

        // Montar payload padrão (Objeto Estruturado)
        const payload = {
            timestamp: new Date().toISOString(),
            totalProducts: 1,
            products: [fullProduct],
            summary: {
                farm: 0,
                dressto: 0,
                kju: 0,
                live: 0,
                zzmall: 1
            }
        };

        console.log('📤 Enviando payload padrão para Webhook...');
        console.log(JSON.stringify(payload, null, 2));

        const res = await axios.post(WEBHOOK_URL, payload);
        console.log(`✅ Webhook disparado! Status: ${res.status}`);

    } catch (err) {
        console.error('❌ Erro no envio manual:', err.message);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

run();
