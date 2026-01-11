const { initBrowser } = require('./browser_setup');
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

        // Scroll gradual para carregar lazy loading
        console.log('Rolando página para carregar produtos...');
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await page.waitForTimeout(1000);
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

            // Helper Safe
            const getSafeText = (el) => {
                if (!el) return '';
                const txt = el.innerText || el.textContent || '';
                return (typeof txt === 'string') ? txt : ''; // Não trim aqui para preservar espaços se necessário, ou trim se preferir
            };

            const allEls = Array.from(document.querySelectorAll('*'));

            // Encontra elementos de preço com segurança
            const priceElements = allEls.filter(el => {
                if (el.children.length > 0) return false; // Apenas folhas
                const txt = getSafeText(el);
                return txt.includes('R$');
            });

            priceElements.forEach(priceEl => {
                // Sobe até achar um container que tenha link para produto (/p)
                let parent = priceEl.parentElement;
                let link = null;
                let sanityCounter = 0;

                while (parent && sanityCounter < 8) { // Reduzido profundidade
                    const foundLink = parent.querySelector('a[href*="/p"]');
                    if (foundLink) {
                        link = foundLink;

                        // Verifica se neste container (o card) existem dois preços
                        const containerText = getSafeText(parent).replace(/\s+/g, ' ');
                        const pricesFound = containerText.match(/R\$\s*[\d.,]+/g);

                        // SE tiver 2 ou mais preços
                        if (pricesFound && pricesFound.length >= 2) {
                            candidates.add(link.href);
                        }
                        break;
                    }
                    parent = parent.parentElement;
                    sanityCounter++;
                }
            });

            return Array.from(candidates);
        });

        console.log(`Encontrados ${foundUrls.length} produtos candidatos em ${categoryName}.`);
        potentials.push(...foundUrls);

    } catch (error) {
        console.error(`Erro ao escanear ${categoryName}:`, error);
    } finally {
        await browser.close();
    }

    return potentials; // Retorna todos os candidatos
}

module.exports = { scanCategory };
