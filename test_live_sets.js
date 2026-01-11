const { scrapeLive } = require('./scrapers/live');

async function testLiveSets() {
    console.log('🧪 TESTE: Verificando lógica de Conjuntos e Preços na Live...\n');

    const startTime = Date.now();
    // Pede uma quota maior para ter chance de formar pares
    const products = await scrapeLive(12);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADO DO TESTE (Live Conjuntos)');
    console.log('='.repeat(60));
    console.log(`Produtos coletados: ${products.length}`);
    console.log(`Tempo de execução: ${duration}s`);

    const sets = [];
    const singles = [];
    const used = new Set();

    // Tenta identificar pares visualmente nos resultados
    for (let i = 0; i < products.length; i++) {
        if (used.has(i)) continue;
        const p1 = products[i];

        let bestMatch = -1;
        let maxScore = 0;

        for (let j = i + 1; j < products.length; j++) {
            if (used.has(j)) continue;
            const p2 = products[j];

            // Score simples de similaridade de nome
            const p1Words = p1.nome.toLowerCase().split(' ').filter(w => w.length > 3);
            const p2Words = p2.nome.toLowerCase().split(' ').filter(w => w.length > 3);
            const intersection = p1Words.filter(w => p2Words.includes(w));

            // Requisito básico: Top + Bottom
            const isTop1 = p1.nome.match(/top|cropped|sutiã/i);
            const isBottom1 = p1.nome.match(/legging|calça|short|saia/i);
            const isTop2 = p2.nome.match(/top|cropped|sutiã/i);
            const isBottom2 = p2.nome.match(/legging|calça|short|saia/i);

            const isComplementary = (isTop1 && isBottom2) || (isBottom1 && isTop2);

            if (intersection.length > 0 && isComplementary) {
                if (intersection.length > maxScore) {
                    maxScore = intersection.length;
                    bestMatch = j;
                }
            }
        }

        if (bestMatch !== -1) {
            sets.push([p1, products[bestMatch]]);
            used.add(i);
            used.add(bestMatch);
        } else {
            singles.push(p1);
        }
    }

    if (sets.length > 0) {
        console.log('\n🧩 PARES ENCONTRADOS NO TESTE:');
        sets.forEach((set, k) => {
            console.log(`   Par #${k + 1}:`);
            console.log(`      1. ${set[0].nome} | R$ ${set[0].precoAtual}`);
            console.log(`      2. ${set[1].nome} | R$ ${set[1].precoAtual}`);
        });
    } else {
        console.log('\n⚠️ NENHUM PAR ENCONTRADO.');
    }

    if (singles.length > 0) {
        console.log('\n👤 PRODUTOS AVULSOS:');
        singles.forEach(p => {
            console.log(`   - ${p.nome} | R$ ${p.precoAtual} (${p.categoria || '?'})`);
        });
    }

    console.log('='.repeat(60));
}

testLiveSets();
