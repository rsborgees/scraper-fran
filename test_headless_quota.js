process.env.HEADLESS = 'true'; // Força modo headless para este teste
const { scrapeFarm } = require('./scrapers/farm/index');

async function testHeadless() {
    console.log('🧪 Iniciando teste de Scraper em modo HEADLESS...');
    console.log('Objetivo: Provar que o anti-detecção funciona sem janelas visuais.\n');

    try {
        const products = await scrapeFarm();
        console.log('\n==========================================');
        console.log(`✅ TESTE CONCLUÍDO!`);
        console.log(`📦 Produtos coletados: ${products.length}`);
        console.log('==========================================\n');

        if (products.length > 0) {
            console.log('👍 SUCESSO: O scraper funcionou em headless!');
            console.log('   Isso confirma que o código está invisível para o site.');
        } else {
            console.log('⚠️ ALERTA: Nenhum produto encontrado. Pode haver bloqueio.');
        }

    } catch (error) {
        console.error('❌ Falha no teste:', error);
    }
}

testHeadless();
