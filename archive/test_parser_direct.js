const { initBrowser } = require('./browser_setup');
const { parseProductDressTo } = require('./scrapers/dressto/parser');

async function runDirectTest() {
    console.log('🧪 Teste Direto do Parser Dress To...');
    const { browser, page } = await initBrowser();

    try {
        console.log('   Navegando para lista...');
        await page.goto('https://www.dressto.com.br/nossas-novidades', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Pega o primeiro link de produto real
        const productUrl = await page.evaluate(() => {
            const el = document.querySelector('a.vtex-product-summary-2-x-clearLink');
            return el ? el.href : null;
        });

        if (!productUrl) {
            console.error('❌ Não achou nenhum link de produto na lista (seletor de lista falhou?)');
            return;
        }

        console.log(`   Link encontrado: ${productUrl}`);
        console.log('   Executando parser...');

        const product = await parseProductDressTo(page, productUrl);

        console.log('\n✅ Resultado do Parser:');
        console.log(JSON.stringify(product, null, 2));

        if (product && product.tamanhos && product.tamanhos.length > 0) {
            console.log('\n✨ SUCESSO: Tamanhos extraídos corretamente!');
        } else {
            console.log('\n⚠️ AVISO: Tamanhos vazios ou produto null.');
        }

    } catch (err) {
        console.error('❌ Erro fatale:', err);
    } finally {
        await browser.close();
    }
}

runDirectTest();
