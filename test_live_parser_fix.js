const { initBrowser } = require('./browser_setup');
const { parseProductLive } = require('./scrapers/live/index');

(async () => {
    console.log('🧪 Testing Enhanced Live Parser...\n');

    const { browser, page } = await initBrowser();

    try {
        // Test with the product mentioned in the user's error
        const testUrl = 'https://www.liveoficial.com.br/macaquinho-shorts-fit-green-noir-black-P137800PT01/p';

        console.log(`📍 Testing URL: ${testUrl}\n`);

        const result = await parseProductLive(page, testUrl);

        if (result) {
            console.log('\n✅ SUCCESS! Product data extracted:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📦 Nome:     ${result.nome}`);
            console.log(`🆔 ID:       ${result.id}`);
            console.log(`💰 Preço:    R$ ${result.preco.toFixed(2)}`);
            console.log(`💵 Original: R$ ${result.preco_original.toFixed(2)}`);
            console.log(`📏 Tamanhos: ${result.tamanhos.length > 0 ? result.tamanhos.join(', ') : 'Nenhum disponível'}`);
            console.log(`🔗 URL:      ${result.url}`);
            console.log(`🖼️  Imagem:   ${result.imageUrl ? 'Encontrada' : 'Não encontrada'}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // Validate critical fields
            const issues = [];
            if (!result.nome || result.nome.length < 3) issues.push('❌ Nome inválido ou vazio');
            if (result.preco === 0) issues.push('❌ Preço zerado');
            if (result.tamanhos.length === 0) issues.push('⚠️  Nenhum tamanho disponível');
            if (!result.imageUrl) issues.push('⚠️  Imagem não encontrada');

            if (issues.length > 0) {
                console.log('\n⚠️  PROBLEMAS DETECTADOS:');
                issues.forEach(issue => console.log(`   ${issue}`));
            } else {
                console.log('\n✨ Todos os campos críticos foram extraídos com sucesso!');
            }
        } else {
            console.log('\n❌ FAILED! Parser returned null');
        }

    } catch (error) {
        console.error('\n💥 ERROR:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
        console.log('\n🏁 Test completed.');
    }
})();
