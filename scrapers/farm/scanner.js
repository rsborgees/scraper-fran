const { initBrowser } = require('../../browser_setup');
const fs = require('fs');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, 'debug');
if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR);

/**
 * Escaneia uma página de categoria (PLP) em busca de produtos com indício de promoção.
 * @param {string} categoryUrl 
 * @param {string} categoryName 
 * @returns {Promise<Array<string>>} Lista de URLs de produtos potenciais.
 */
async function scanCategory(categoryUrl, categoryName) {
    console.log(`--- Escaneando Categoria: ${categoryName} ---`);
    const { browser, page } = await initBrowser();
    const potentials = [];

    try {
        await page.goto(categoryUrl, { waitUntil: 'domcontentloaded' });

        // MEGA SCROLL ROBUSTO (Slow & Steady)
        // Rola 50 vezes, mas espera o carregamento real da página
        console.log('Rolando página... (Modo: Lento e Confiável)');

        let lastHeight = await page.evaluate('document.body.scrollHeight');
        let unchangedCount = 0;

        for (let i = 0; i < 50; i++) {
            // Rola até o rodapé atual
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

            // ESPERA DE CARREGAMENTO (2 segundos)
            // Dá tempo para o ícone de loading girar e os produtos aparecerem
            await page.waitForTimeout(2000);

            let newHeight = await page.evaluate('document.body.scrollHeight');

            if (newHeight === lastHeight) {
                unchangedCount++;
                console.log(`   ⏳ Carregando... (${unchangedCount}/3)`);
                if (unchangedCount >= 3) {
                    console.log('   🛑 Fim da página detectado e confirmado.');
                    break;
                }
            } else {
                unchangedCount = 0; // Reset se carregou coisa nova
                lastHeight = newHeight;
                console.log(`   📜 Scroll #${i + 1}: Novos produtos carregados.`);
            }
        }

        // Espera de estabilidade visual
        await page.waitForTimeout(2000);

        // Screenshot DEBUG da listagem
        const screenshotPath = path.join(DEBUG_DIR, `list_${categoryName}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`📸 Screenshot salvo: ${screenshotPath}`);

        // Extraí URLs de produtos que parecem ter desconto
        // Heurística MELHORADA (SAFE MODE)
        const foundUrls = await page.evaluate(() => {
            const candidates = new Set();

            // Pega todos os cards de produto
            const productCards = document.querySelectorAll('a.card');

            productCards.forEach(card => {
                // Heurística de Promoção: Procura por preço riscado ou cor de destaque (amarelo/laranja na Farm)
                const hasLineThrough = !!card.querySelector('.line-through');
                const hasWarningPrice = !!card.querySelector('.text-warning-content');

                // EXTRAÇÃO DE URL: Garante que é um link de produto válido (/p)
                let href = card.href;
                if (href && (href.includes('/p?') || href.includes('/p/'))) {
                    try {
                        const baseUrl = href.split('?')[0];
                        if (baseUrl.endsWith('/p')) {
                            href = baseUrl;
                        }
                    } catch (e) { }

                    candidates.add(href);
                }
            });

            // Se não achou nada com a seletor de classe, tenta a busca por links de produto
            if (candidates.size === 0) {
                const allLinks = Array.from(document.querySelectorAll('a[href*="/p"]'));
                allLinks.forEach(link => {
                    const href = link.href;
                    if (href && (href.includes('/p?') || href.includes('/p/'))) {
                        candidates.add(href);
                    }
                });
            }

            return Array.from(candidates);
        });

        console.log(`Encontrados ${foundUrls.length} produtos em ${categoryName}.`);
        potentials.push(...foundUrls);

    } catch (error) {
        console.error(`Erro ao escanear ${categoryName}:`, error);
    } finally {
        await browser.close();
    }

    return potentials; // Retorna todos os candidatos
}

module.exports = { scanCategory };
