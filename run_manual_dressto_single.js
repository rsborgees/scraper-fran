require('dotenv').config();
const axios = require('axios');
const { initBrowser } = require('./browser_setup');
const { parseProductDressTo } = require('./scrapers/dressto/parser');
const { findFileByProductId } = require('./driveManager');
const { buildDressMessage } = require('./messageBuilder');

// Config
const WEBHOOK_URL = "https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/skraper-v2";
const TARGET_ID = '01342814';
const TARGET_URL = 'https://www.dressto.com.br/vestido-cropped-estampa-mares-01342814-2384/p';

async function run() {
    console.log(`🚀 Iniciando envio manual Dress To para ${TARGET_ID}...`);

    // 1. Encontrar imagem no Drive
    console.log('📂 Buscando imagem no Drive...');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    let driveUrl = null;

    if (folderId) {
        try {
            const fileData = await findFileByProductId(folderId, TARGET_ID);
            if (fileData) {
                driveUrl = fileData.driveUrl;
                console.log(`✅ Imagem encontrada: ${fileData.name}`);
            } else {
                console.log('⚠️ Imagem não encontrada no Drive. O usuário pediu explicitamente "com a foto do drive".');
                // Could throw error, but let's try to proceed or ask user?
                // The prompt was "manda com a foto do drive". If no photo, I fail.
                throw new Error(`Imagem para o produto ${TARGET_ID} não encontrada no Google Drive.`);
            }
        } catch (err) {
            console.error('❌ Erro no Drive:', err.message);
            return;
        }
    } else {
        console.error('❌ GOOGLE_DRIVE_FOLDER_ID não configurado.');
        return;
    }

    // 2. Scrape do Produto
    console.log('\n🌐 Iniciando Browser...');
    const { browser, context, page } = await initBrowser();

    try {
        // 🛡️ ANTI-REDIRECT: Enforce Brazil Region
        await context.addCookies([
            {
                name: 'vtex_segment',
                value: 'eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9',
                domain: '.dressto.com.br',
                path: '/'
            }
        ]).catch(() => { });

        // Force sc=1 in the URL
        const finalUrl = TARGET_URL.includes('?') ? `${TARGET_URL}&sc=1` : `${TARGET_URL}?sc=1`;
        console.log(`📄 Acessando ${finalUrl}...`);
        const product = await parseProductDressTo(page, finalUrl);

        if (!product) {
            throw new Error('Falha ao parsear produto. Verifique a URL ou seletores.');
        }

        console.log(`📦 Produto parseado: ${product.nome} | R$${product.precoAtual}`);

        // 3. Substituir Imagem e Ajustar ID
        console.log('🖼️  Substituindo imagem pela do Drive...');
        product.imagePath = driveUrl;
        product.imageUrl = driveUrl; // For safety

        // Force ID match (just in case parser extracts something weird)
        product.id = TARGET_ID;
        product.loja = 'dressto';

        // 4. Build Message
        const caption = buildDressMessage(product);

        // 5. Enviar Webhook
        const payload = {
            id: product.id,
            store: 'dressto',
            image: product.imagePath,
            caption: caption,
            price: product.precoAtual,
            original_price: product.precoOriginal,
            installments: null,
            sizes: product.tamanhos ? product.tamanhos.join(',') : '',
            url: product.url,
            is_manual: true
        };

        console.log('\n📤 Enviando payload para Webhook...');
        // console.log(JSON.stringify(payload, null, 2));

        const res = await axios.post(WEBHOOK_URL, payload);
        console.log(`✅ Webhook enviado com SUCESSO! Status: ${res.status}`);
        console.log('Resposta:', res.data);

    } catch (err) {
        console.error('❌ Erro durante execução:', err.message);
    } finally {
        await browser.close();
        console.log('🔒 Browser fechado.');
    }
}

run();
