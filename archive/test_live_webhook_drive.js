const { initBrowser } = require('./browser_setup');
const { scrapeLiveByName } = require('./scrapers/live/nameScanner');
const { buildLiveMessage } = require('./messageBuilder');
const axios = require('axios');
require('dotenv').config();

(async () => {
    console.log('🚀 Teste Live com Drive + Webhook\n');

    const { browser, context } = await initBrowser();

    try {
        // Item de teste do Drive
        const driveItem = {
            name: "macaquinho shorts fit green",
            id: "LIVE_test_" + Date.now(),
            searchByName: true,
            driveUrl: "https://drive.google.com/uc?export=download&id=16Vnoqru1GXF42LLrILzfd94p6UWLKvF2",
            isFavorito: false
        };

        console.log(`📦 Item de teste: "${driveItem.name}"`);
        console.log(`🖼️  Foto do Drive: ${driveItem.driveUrl}\n`);

        // Busca o produto
        console.log('🔍 Buscando produto no site da Live...\n');
        const products = await scrapeLiveByName(context, [driveItem], 1);

        if (!products || products.length === 0) {
            console.log('❌ Nenhum produto encontrado!');
            return;
        }

        const product = products[0];

        console.log('✅ Produto capturado:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📦 Nome:     ${product.nome}`);
        console.log(`🆔 ID:       ${product.id}`);
        console.log(`💰 Preço:    R$ ${product.preco}`);
        console.log(`📏 Tamanhos: ${product.tamanhos.join(', ')}`);
        console.log(`🖼️  Imagem:   ${product.imagePath || product.imageUrl}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Prepara dados para webhook
        product.precoAtual = product.preco;
        product.precoOriginal = product.preco_original || product.preco;

        // Gera mensagem
        const message = buildLiveMessage([product]);

        console.log('📝 Mensagem gerada:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Envia para webhook
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) {
            console.log('⚠️  WEBHOOK_URL não configurado no .env');
            console.log('   Pulando envio para webhook.\n');
            return;
        }

        console.log('📤 Enviando para webhook...\n');

        const payload = {
            message: message,
            image: product.imagePath || product.imageUrl,
            store: 'live',
            productId: product.id,
            productName: product.nome,
            price: product.preco,
            url: product.url
        };

        console.log('📦 Payload:');
        console.log(JSON.stringify(payload, null, 2));
        console.log('');

        const response = await axios.post(webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        console.log('✅ Webhook enviado com sucesso!');
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data)}\n`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    } finally {
        await browser.close();
        console.log('🏁 Teste finalizado.');
    }
})();
