const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildFarmMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const fs = require('fs');
const path = require('path');

async function generateAndSend() {
    console.log('🧪 Gerando payload para Conjunto Farm (Drive-First)...');

    // IDs confirmados como disponíveis: Top (357978) + Saia (357979) Primor de Abacaxi
    const driveItems = [
        {
            id: '357978',
            ids: ['357978', '357979'],
            isSet: true,
            isFavorito: true,
            store: 'farm',
            driveUrl: 'https://drive.google.com/uc?export=download&id=1_sample_drive_id' // URL de exemplo do Drive
        }
    ];

    const { browser, context } = await initBrowser();

    try {
        // Ignora histórico para o teste manual/payload solicitado
        process.env.SKIP_HISTORY_CHECK = "true";
        const { products } = await scrapeSpecificIds(context, driveItems, 1);
        delete process.env.SKIP_HISTORY_CHECK;

        if (products.length > 0) {
            const product = products[0];
            console.log(`✅ Conjunto capturado: ${product.nome}`);

            // Tenta ler o estado atual do reloginho para o cupom
            let reloginhoData = null;
            try {
                const statePath = path.join(__dirname, 'data', 'reloginho_state.json');
                if (fs.existsSync(statePath)) {
                    reloginhoData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                }
            } catch (e) {
                console.warn('⚠️ Não foi possível ler reloginho_state.json, usando padrão.');
            }

            // Gera a mensagem
            product.message = buildFarmMessage(product, reloginhoData);
            console.log('\n--- MENSAGEM GERADA ---');
            console.log(product.message);
            console.log('-----------------------\n');

            // Envia para o webhook
            console.log('🚀 Enviando para o webhook padrão...');
            const webhookResult = await sendToWebhook([product]);

            if (webhookResult && (webhookResult.success || (Array.isArray(webhookResult) && webhookResult[0].success))) {
                console.log('✅ SUCESSO: Payload enviado ao webhook.');
            } else {
                console.log('⚠️ Resposta do Webhook:', JSON.stringify(webhookResult, null, 2));
            }
        } else {
            console.log('❌ FALHA: Nenhum produto foi capturado.');
        }
    } catch (err) {
        console.error('❌ Erro durante a geração/envio:', err.stack);
    } finally {
        await browser.close();
        console.log('🔓 Navegador fechado.');
    }
}

generateAndSend();
