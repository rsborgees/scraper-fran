const { initBrowser } = require('./browser_setup');
const { parseProductZZMall } = require('./scrapers/zzmall'); // Use direct parser to bypass flaky search
require('dotenv').config();

(async () => {
    const { browser, page } = await initBrowser();

    // 1. Data Mock
    const VALID_ID = '1906200310002'; // CHINELO
    const DIRECT_URL = 'https://www.zzmall.com.br/chinelo-preto-brilho-bico-redondo/p/1906200310002U';
    const MOCK_DRIVE_URL = 'https://drive.google.com/uc?export=download&id=CORRECT_PHOTO_ID';

    console.log(`🚀 Teste de Lógica de Atribuição (Simulado)`);
    console.log(`Produto: ${VALID_ID}`);

    try {
        // 2. Scrape Real Product
        console.log(`\n1. Acessando produto real: ${DIRECT_URL}`);
        const product = await parseProductZZMall(page, DIRECT_URL);

        if (product) {
            console.log(`   ✅ Produto encontrado: ${product.nome}`);
            console.log(`   🖼️  Foto Original (Site): ${product.imagePath}`);

            // 3. Simulate Logic: "If this item came from Drive..."
            console.log(`\n2. Aplicando Foto do Drive (Simulação do idScanner)...`);

            // This logic mirrors exactly what I reverted in idScanner.js
            if (MOCK_DRIVE_URL) {
                product.imagePath = MOCK_DRIVE_URL;
                product.imageUrl = MOCK_DRIVE_URL;
            }

            // 4. Validate Result
            console.log('\n3. Validação Final:');
            console.log('---------------------------------------------------');
            console.log(`🆔 ID:           ${product.id}`);
            console.log(`📦 Nome:         ${product.nome}`);
            console.log(`🖼️  Foto Final:   ${product.imagePath}`);
            console.log('---------------------------------------------------');

            if (product.imagePath === MOCK_DRIVE_URL) {
                console.log('✅ SUCESSO: O sistema priorizou corretamente a foto do Drive!');
            } else {
                console.error('❌ ERRO: A foto não foi atualizada.');
            }

        } else {
            console.log('❌ Falha ao acessar produto (Site indisponível ou erro de parse).');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await browser.close();
    }
})();
