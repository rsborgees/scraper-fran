const { parseProduct } = require('./parser');
const { initBrowser } = require('../../browser_setup');

(async () => {
    console.log('🚀 Iniciando Teste Mockado (Interceptor) de Desconto Temporário...');
    const { browser, page } = await initBrowser();
    const targetUrl = 'https://www.farmrio.com.br/vestido-teste-interceptor/p';

    try {
        await page.route(targetUrl, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: `
                    <html>
                        <head><title>Produto Teste</title></head>
                        <body>
                            <div class="vtex-store-components-3-x-productNameContainer">
                                <span>Vestido Teste Interceptor</span>
                            </div>
                            <div class="productReference">REF99999</div>
                            
                            <!-- Simula Preço Original 500 e Atual 250 -->
                            <span id="list-price">R$ 500,00</span>
                            <span id="price">R$ 250,00</span>
                            
                            <div class="size-item">P</div>
                        </body>
                    </html>
                `
            });
        });

        // Executa o parser
        const result = await parseProduct(page, targetUrl);

        if (result) {
            console.log('\n✅ Resultado do Parse (MOCK):');
            console.log(JSON.stringify(result, null, 2));

            // 250 * 0.9 = 225
            const expected = 225.00;

            if (result.precoAtual === expected) {
                console.log(`\n✅ SUCESSO! Preço R$ 250,00 virou R$ ${result.precoAtual}`);
            } else {
                console.log(`\n❌ ERRO! Preço R$ 250,00 virou R$ ${result.precoAtual} (Esperado: ${expected})`);
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
