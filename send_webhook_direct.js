const { initBrowser } = require('./browser_setup');
const { parseProductLive } = require('./scrapers/live/index');
const { buildLiveMessage } = require('./messageBuilder');
const axios = require('axios');
require('dotenv').config();

(async () => {
    console.log('🚀 LIVE: Enviando Payload Webhook Direto\n');

    const { browser, page } = await initBrowser();

    try {
        const webhookUrl = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
        // Usando o URL que o debug encontrou
        const productUrl = 'https://www.liveoficial.com.br/macaquinho-shorts-fit-green-noir-black-P137800PT01/p';
        const driveImageUrl = 'https://drive.google.com/uc?export=download&id=16Vnoqru1GXF42LLrILzfd94p6UWLKvF2';

        console.log(`🔗 Acessando URL: ${productUrl}`);
        const product = await parseProductLive(page, productUrl);

        if (!product) {
            console.log('❌ Falha ao extrair produto.');
            return;
        }

        // Sobrepõe com dados do Drive
        product.imagePath = driveImageUrl;
        product.imageUrl = driveImageUrl;
        product.precoAtual = product.preco;
        product.precoOriginal = product.preco_original || product.preco;
        product.loja = 'live';

        console.log('\n📦 Dados extraídos:');
        console.log(`   Nome:  ${product.nome}`);
        console.log(`   Preço: R$ ${product.preco}`);

        // Gera mensagem
        const message = buildLiveMessage([product]);

        // Payload final
        const payload = {
            message: message,
            image: product.imagePath,
            store: 'live',
            productId: product.id,
            productName: product.nome,
            price: product.preco,
            url: product.url
        };

        console.log('\n🔥 PAYLOAD DO WEBHOOK:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(JSON.stringify(payload, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (webhookUrl) {
            console.log(`📤 Enviando para ${webhookUrl}...`);
            const response = await axios.post(webhookUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });
            console.log(`✅ Sucesso! Status: ${response.status}`);
        } else {
            console.log('⚠️ WEBHOOK_URL não definida.');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await browser.close();
        console.log('\n🏁 Fim do envio direto.');
    }
})();
