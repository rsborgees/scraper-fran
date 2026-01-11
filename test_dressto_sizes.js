const { parseProductDressTo } = require('./scrapers/dressto');
const { initBrowser } = require('./browser_setup');

async function test() {
    const { browser, page } = await initBrowser();

    try {
        const url = 'https://www.dressto.com.br/vestido-estampa-veranil-01342760-2368/p';

        console.log('\n🧪 Testando extração de tamanhos do DressTo...');
        console.log(`URL: ${url}\n`);

        const product = await parseProductDressTo(page, url);

        if (product) {
            console.log('\n📊 RESULTADO:');
            console.log('Nome:', product.nome);
            console.log('Preço:', `R$ ${product.precoAtual}`);
            console.log('Tamanhos encontrados:', product.tamanhos);
            console.log('\n✅ Tamanhos corretos? (Deve ter apenas PP, P, M, G, GG - SEM números de sapato)');

            // Verificar se há números de sapato
            const shoeSize = product.tamanhos.some(size => /^\d+$/.test(size));
            if (shoeSize) {
                console.log('❌ ERRO: Ainda há tamanhos numéricos (sapato) na lista!');
            } else {
                console.log('✅ SUCESSO: Apenas tamanhos de roupa válidos!');
            }
        } else {
            console.log('❌ Produto não foi parseado');
        }

    } catch (error) {
        console.error('Erro no teste:', error);
    } finally {
        await browser.close();
    }
}

test();
