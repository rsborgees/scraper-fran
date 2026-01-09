const { initBrowser } = require('../../browser_setup');
const fs = require('fs');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, 'debug');
if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR);

/**
 * Escaneia uma página de categoria (PLP) em busca de produtos com indício de promoção.
 */
async function scanCategory(page, categoryUrl, categoryName, minCandidates = 0, maxScrolls = 50) {
    console.log(`--- Escaneando Categoria: ${categoryName} (Alvo: ${minCandidates > 0 ? minCandidates + ' itens' : 'Auto'}) ---`);
    const potentials = new Set();

    try {
        await page.goto(categoryUrl, { waitUntil: 'domcontentloaded' });
        console.log('⏳ Aguardando carregamento inicial da página (3s)...');
        await page.waitForTimeout(3000); // Reduzi para 3s para ser mais ágil
        console.log('Rolando página... (Modo: Agressivo/Persistente)');

        let lastHeight = await page.evaluate('document.body.scrollHeight');
        let unchangedCount = 0;
        let consecutiveEmptyScrolls = 0;

        for (let i = 0; i < maxScrolls; i++) {
            // 📜 Rolagem Lenta e Progressiva (Estilo Live)
            console.log(`   📜 [${categoryName}] Scroll #${i + 1}/${maxScrolls} | Descendo a página...`);

            // Rola em 4 passos menores para dar tempo do site carregar e o usuário acompanhar
            for (let step = 0; step < 4; step++) {
                await page.evaluate(() => {
                    window.scrollBy(0, 800);
                });
                await page.waitForTimeout(1500); // 1.5s entre micro-scrolls (Otimizado para velocidade)
            }

            // Coleta PARCIAL a cada scroll para verificar progresso
            const currentFound = await page.evaluate(() => {
                const found = [];
                document.querySelectorAll('a.card, a[href*="/p"]').forEach(el => {
                    let href = el.href;
                    if (href && (href.includes('/p?') || href.includes('/p/'))) found.push(href);
                });
                return found;
            });

            const prevSize = potentials.size;
            currentFound.forEach(url => potentials.add(url));
            const newSize = potentials.size;

            // Log de progresso mais limpo
            if (newSize > prevSize) {
                console.log(`      ✨ Encontrados +${newSize - prevSize} novos candidatos (Total: ${newSize}).`);
                consecutiveEmptyScrolls = 0; // Reset
            } else {
                console.log(`      ⏳ Nenhum item novo neste scroll...`);
                consecutiveEmptyScrolls++;
            }

            // Critério de Parada 1: Atingiu o alvo (com margem de segurança)
            if (minCandidates > 0 && potentials.size >= minCandidates) {
                console.log(`   ✅ Alvo de candidatos atingido! (${potentials.size}/${minCandidates})`);
                break;
            }

            // Critério de Parada 2: Fim da página (altura não muda)
            let newHeight = await page.evaluate('document.body.scrollHeight');
            if (newHeight === lastHeight) {
                unchangedCount++;
                // Se estamos em modo "Alvo Definido" (Hammer Mode), somos mais céticos, mas sem exagerar (5 scrolls)
                const triggerLimit = minCandidates > 0 ? 5 : 3;

                if (unchangedCount >= triggerLimit) {
                    console.log('\n   🛑 Fim da página detectado.');
                    break;
                }
            } else {
                unchangedCount = 0;
                lastHeight = newHeight;
            }

            // Critério de Parada 3: Segurança (8 scrolls sem nada novo - Otimizado)
            if (consecutiveEmptyScrolls > 8) {
                console.log('\n   ⚠️ Parando: 8 scrolls sem novos produtos.');
                break;
            }
        }

        // Screenshot DEBUG final
        const screenshotPath = path.join(DEBUG_DIR, `list_${categoryName}_final.png`);
        try { await page.screenshot({ path: screenshotPath, fullPage: false }); } catch (e) { }

    } catch (error) {
        console.error(`Erro ao escanear ${categoryName}:`, error);
    }

    // Filtragem final robusta
    const candidateArray = Array.from(potentials).filter(url => {
        return (url.includes('/p?') || url.includes('/p/')) && !url.includes('login') && !url.includes('wishlist');
    });

    // Limpa a URL para o formato base
    const cleanCandidates = candidateArray.map(url => {
        try { return url.split('?')[0]; } catch (e) { return url; }
    });

    console.log(`Balanço Final ${categoryName}: ${cleanCandidates.length} candidatos únicos.`);
    return cleanCandidates;
}

module.exports = { scanCategory };
