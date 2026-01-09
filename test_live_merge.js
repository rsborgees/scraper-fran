const { scrapeLive } = require('./scrapers/live');

// Simula a função buildLiveMessage para teste
function buildLiveMessage(chunk) {
    if (chunk.length === 1 && chunk[0].set) {
        return `SET MERGED MSG: ${chunk[0].nome}`;
    }
    return `MSG for ${chunk.length} items`;
}

async function testMergeLogic() {
    console.log('🧪 TESTE: Verificando Lógica de Merge do Orchestrator (Live)...');

    // Pega produtos reais do scraper
    const products = await scrapeLive(12);
    const allProducts = [];

    console.log(`\n📦 Scraper retornou ${products.length} itens.`);

    // === LÓGICA DO ORCHESTRATOR (Copiada para validação) ===
    let i = 0;
    while (i < products.length) {
        const current = products[i];
        let chunk = [];

        if (current.type === 'onepiece') {
            // Peça única -> Mantém objeto original
            chunk = [current];
            i++;
        } else {
            // Par Top + Bottom (qualquer)
            const next = products[i + 1];
            if (next && next.type !== 'onepiece') {
                // MERGE 2 produtos em 1 objeto SET
                console.log(`   🔗 Merging ${current.nome} + ${next.nome}`);

                const mergedProduct = {
                    ...current,
                    id: `${current.id}_${next.id}`,
                    nome: `${current.nome} + ${next.nome}`,
                    preco: parseFloat((current.preco + next.preco).toFixed(2)),
                    precoOriginal: parseFloat(((current.precoOriginal || current.preco) + (next.precoOriginal || next.preco)).toFixed(2)),
                    imageUrl: current.imageUrl,
                    imagePath: current.imagePath,
                    link: current.url,
                    loja: 'live',
                    set: true
                };

                chunk = [mergedProduct];
                i += 2;
            } else {
                // Órfão
                chunk = [current];
                i++;
            }
        }

        // Gera mensagem e adiciona ao output final
        if (chunk.length > 0) {
            const msg = buildLiveMessage(chunk);
            chunk.forEach(p => p.message = msg);
            allProducts.push(...chunk);
        }
    }
    // ========================================================

    console.log('\n📊 RESULTADO FINAL (allProducts):');
    allProducts.forEach((p, idx) => {
        console.log(`\n[${idx + 1}] ID: ${p.id}`);
        console.log(`    Nome: ${p.nome}`);
        console.log(`    Preço: ${p.preco}`);
        console.log(`    Set Merged? ${p.set ? 'SIM' : 'NÃO'}`);
    });
}

testMergeLogic();
