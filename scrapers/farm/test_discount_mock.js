const { parseProduct } = require('./parser');
const { initBrowser } = require('../../browser_setup');

(async () => {
    console.log('🚀 Iniciando Teste Mockado de Desconto Temporário...');
    const { browser, page } = await initBrowser();

    try {
        // Mock HTML de um produto válido
        const mockHtml = `
            <html>
                <body>
                    <div class="vtex-store-components-3-x-productNameContainer">
                        <span>Vestido Teste Mock</span>
                    </div>
                    <div class="productReference">REF123456</div>
                    
                    <!-- Simula Preço Original 500 e Atual 250 (50% off) -->
                    <span id="list-price">R$ 500,00</span>
                    <span id="price">R$ 250,00</span>
                    
                    <!-- Simula Tamanhos Disponíveis -->
                    <div class="size-item">P</div>
                    <div class="size-item">M</div>
                    
                    <!-- Falsifica URL para passar no regex -->
                    <script>
                        window.history.pushState({}, '', 'https://www.farmrio.com.br/vestido-teste/p');
                    </script>
                </body>
            </html>
        `;

        // Carrega o Mock
        await page.setContent(mockHtml);

        // Executa o parser na URL fake (que o parser vai ler do window.location ou argumento)
        const result = await parseProduct(page, 'https://www.farmrio.com.br/vestido-teste/p');

        if (result) {
            console.log('\n✅ Resultado do Parse (MOCK):');
            console.log(JSON.stringify(result, null, 2));

            // Verificação da Lógica Solicitada
            // Entrada: 250.00
            // Desconto 10%: 250 * 0.9 = 225.00
            const expected = 225.00;

            if (result.precoAtual === expected) {
                console.log(`\n✅ SUCESSO! Preço R$ 250,00 virou R$ ${result.precoAtual} (Esperado: ${expected})`);
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
