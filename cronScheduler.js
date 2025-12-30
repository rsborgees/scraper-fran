const cron = require('node-cron');
const axios = require('axios');
const { runAllScrapers } = require('./orchestrator');

// Webhook Configuration
const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

/**
 * Envia os dados coletados para o webhook
 * @param {Array} products - Lista de produtos coletados
 */
async function sendToWebhook(products) {
    try {
        console.log(`\n📤 Enviando ${products.length} produtos para webhook...`);

        // Formata os dados no formato esperado
        const payload = {
            timestamp: new Date().toISOString(),
            totalProducts: products.length,
            products: products,
            summary: {
                farm: products.filter(p => p.loja === 'farm').length,
                dressto: products.filter(p => p.loja === 'dressto').length,
                kju: products.filter(p => p.loja === 'kju').length,
                live: products.filter(p => p.loja === 'live').length,
                zzmall: products.filter(p => p.loja === 'zzmall').length
            }
        };

        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 segundos
        });

        console.log('✅ Dados enviados com sucesso para webhook!');
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);

        return { success: true, response: response.data };
    } catch (error) {
        console.error('❌ Erro ao enviar para webhook:', error.message);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data)}`);
        }
        return { success: false, error: error.message };
    }
}

/**
 * Executa o scraper completo e envia para webhook
 */
async function runScheduledScraping() {
    console.log('\n' + '='.repeat(60));
    console.log(`⏰ SCRAPING AGENDADO INICIADO - ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(60) + '\n');

    try {
        // 1. Executa todos os scrapers
        const allProducts = await runAllScrapers();

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESULTADO DO SCRAPING');
        console.log('='.repeat(60));
        console.log(`Total de produtos coletados: ${allProducts.length}/120\n`);

        // 2. Envia para webhook
        const webhookResult = await sendToWebhook(allProducts);

        console.log('\n' + '='.repeat(60));
        console.log('✅ SCRAPING AGENDADO CONCLUÍDO');
        console.log('='.repeat(60) + '\n');

        return { products: allProducts, webhook: webhookResult };
    } catch (error) {
        console.error('\n❌ Erro no scraping agendado:', error);

        // Tenta enviar notificação de erro para webhook
        try {
            await axios.post(WEBHOOK_URL, {
                error: true,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        } catch (webhookError) {
            console.error('❌ Erro ao notificar webhook sobre falha:', webhookError.message);
        }

        throw error;
    }
}

/**
 * Configura o agendamento diário às 7h da manhã
 */
function setupDailySchedule() {
    console.log('\n🕐 Configurando agendamento diário...');

    // Cron: Todos os dias às 7h da manhã (0 7 * * *)
    // Formato: segundo minuto hora dia mês dia-da-semana
    const cronExpression = '0 7 * * *';

    cron.schedule(cronExpression, async () => {
        await runScheduledScraping();
    }, {
        timezone: "America/Sao_Paulo"
    });

    console.log('✅ Agendamento configurado: 7h da manhã (horário de Brasília)');
    console.log(`   Próxima execução: ${getNextRunTime()}\n`);
}

/**
 * Calcula o horário da próxima execução
 */
function getNextRunTime() {
    const now = new Date();
    const next = new Date(now);

    next.setHours(7, 0, 0, 0);

    // Se já passou das 7h hoje, agenda para amanhã
    if (now.getHours() >= 7) {
        next.setDate(next.getDate() + 1);
    }

    return next.toLocaleString('pt-BR');
}

/**
 * Executa teste manual (útil para verificação)
 */
async function runManualTest() {
    console.log('\n🧪 MODO DE TESTE MANUAL\n');
    await runScheduledScraping();
}

// Exporta funções
module.exports = {
    setupDailySchedule,
    runScheduledScraping,
    runManualTest,
    sendToWebhook
};

// Se executado diretamente, inicia o agendador
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--test')) {
        // Modo teste: executa imediatamente
        runManualTest().then(() => {
            console.log('\n✅ Teste concluído. Encerrando...');
            process.exit(0);
        }).catch(error => {
            console.error('\n❌ Teste falhou:', error);
            process.exit(1);
        });
    } else {
        // Modo normal: inicia agendador
        setupDailySchedule();

        console.log('🚀 Sistema de agendamento ativo!');
        console.log('   Pressione Ctrl+C para encerrar\n');

        // Mantém o processo rodando
        process.on('SIGINT', () => {
            console.log('\n\n👋 Encerrando agendador...');
            process.exit(0);
        });
    }
}
