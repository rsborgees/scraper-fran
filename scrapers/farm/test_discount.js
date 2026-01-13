const { parseProduct } = require('./parser');
const { initBrowser } = require('../../browser_setup');

(async () => {
    console.log('🚀 Iniciando Teste de Desconto Temporário...');
    const url = 'https://www.farmrio.com.br/vestido-curto-cajueiro/p'; // Exemplo de URL

    const { browser, page } = await initBrowser();

    try {
        console.log(`Checking URL: ${url}`);
        const result = await parseProduct(page, url);

        if (result) {
            console.log('\n✅ Resultado do Parse:');
            console.log(JSON.stringify(result, null, 2));

            // Verificação manual visual
            if (result.precoAtual && result.precoOriginal) {
                console.log(`\n💰 Análise de Preço:`);
                console.log(`Original: R$ ${result.precoOriginal}`);
                console.log(`Final (Com Desconto): R$ ${result.precoAtual}`);
                console.log(`Ratio: ${(result.precoAtual / result.precoOriginal).toFixed(2)} (Esperado ~0.90 se original era igual ao atual antes do desconto)`);
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
