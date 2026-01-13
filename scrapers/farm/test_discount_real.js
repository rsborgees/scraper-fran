const { parseProduct } = require('./parser');
const { initBrowser } = require('../../browser_setup');

(async () => {
    console.log('🚀 Iniciando Teste REAL de Desconto Temporário...');
    const url = 'https://www.farmrio.com.br/vestido-bordado-richelieu-sol-multicolorido-323226-2276/p?brand=farm';

    // Configurações para garantir sucesso no request real
    process.env.HEADLESS = 'true';

    const { browser, page } = await initBrowser();

    try {
        console.log(`Checking URL: ${url}`);
        const result = await parseProduct(page, url);

        if (result) {
            console.log('\n✅ Resultado do Parse (REAL):');
            console.log(JSON.stringify(result, null, 2));

            // Verificação Visual
            if (result.precoAtual && result.precoOriginal) {
                console.log(`\n💰 Análise de Preço:`);
                console.log(`Original Detectado pelo Parser: R$ ${result.precoOriginal}`);
                console.log(`Final (Com Desconto 10% auto): R$ ${result.precoAtual}`);
                console.log(`Ratio: ${(result.precoAtual / result.precoOriginal).toFixed(3)}`);
            }
        } else {
            console.log('❌ Falha ao fazer parse do produto (null result).');
        }

    } catch (error) {
        console.error('❌ Erro no teste:', error);
    } finally {
        await browser.close();
    }
})();
