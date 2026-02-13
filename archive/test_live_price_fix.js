const { scrapeLive } = require('./scrapers/live/index');

(async () => {
    console.log("🧪 TESTE DE VERIFICAÇÃO - CORREÇÃO DE PREÇOS LIVE 🧪\n");

    try {
        const products = await scrapeLive(5);

        console.log("\n📊 VERIFICAÇÃO DE PREÇOS:");
        console.log("=".repeat(70));

        if (products.length === 0) {
            console.log("❌ Nenhum produto foi extraído!");
        } else {
            let allValid = true;

            products.forEach((p, i) => {
                const isValid = p.precoAtual >= 50 && p.precoAtual < 1000;
                const status = isValid ? '✅' : '❌';

                console.log(`\n${i + 1}. ${status} ${p.nome}`);
                console.log(`   💰 Preço: R$ ${p.precoAtual.toFixed(2)}`);
                console.log(`   📏 Tamanhos: ${p.tamanhos.join(', ') || 'N/A'}`);
                console.log(`   🔗 ${p.url}`);

                if (!isValid) {
                    console.error(`   ⚠️  PREÇO SUSPEITO! Esperado entre R$ 50 e R$ 1000`);
                    console.error(`   💡 Pode ser valor de parcela ao invés do preço real`);
                    allValid = false;
                }
            });

            console.log("\n" + "=".repeat(70));

            if (allValid) {
                console.log("✅ SUCESSO! Todos os preços estão no range esperado (R$ 50 - R$ 1000)");
                console.log(`✅ Total: ${products.length} produtos extraídos corretamente!`);
            } else {
                console.log("❌ FALHA! Alguns preços estão fora do range esperado");
                console.log("💡 Verifique se ainda está pegando valores de parcelas");
            }
        }

    } catch (err) {
        console.error("❌ Erro no teste:", err.message);
        console.error(err.stack);
    }
})();
