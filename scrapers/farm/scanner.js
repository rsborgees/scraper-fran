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

            // Pega todos os cards de produto
            const productCards = document.querySelectorAll('a.card');

            productCards.forEach(card => {
                // Heurística de Promoção: Procura por preço riscado ou cor de destaque (amarelo/laranja na Farm)
                const hasLineThrough = !!card.querySelector('.line-through');
                const hasWarningPrice = !!card.querySelector('.text-warning-content');

                // Se o card tem indício de promoção e um link válido de produto
                let href = card.href;
                if ((hasLineThrough || hasWarningPrice) && href && (href.includes('/p?') || href.includes('/p/'))) {
                    // Limpeza de URL: Garante que termina em /p e remove lixo
                    // Exemplo: .../nome-do-produto/p?brand=farm -> .../nome-do-produto/p
                    try {
                        const baseUrl = href.split('?')[0];
                        if (baseUrl.endsWith('/p')) {
                            href = baseUrl;
                        }
                    } catch (e) { }

                    candidates.add(href);
                }
            });

            // Fallback para estrutura antiga ou caso mudem as classes base:
            // Se não achou nada com a seletor de classe, tenta a busca por texto de preço
            if (candidates.size === 0) {
                const getSafeText = (el) => el ? (el.innerText || el.textContent || '').trim() : '';
                const allLinks = Array.from(document.querySelectorAll('a[href*="/p"]'));

                allLinks.forEach(link => {
                    const txt = getSafeText(link).replace(/\s+/g, ' ');
                    const pricesFound = txt.match(/R\$\s*[\d.,]+/g);

                    // Só aceita como promoção se tiver 2 preços E não for apenas o parcelamento
                    // Geralmente o parcelamento vem com "ou X de"
                    if (pricesFound && pricesFound.length >= 2) {
                        // Verifica se um dos preços é "riscado" via estilo se possível, ou se não é "ou X de"
                        const hasInstallments = /ou\s+\d+x\s+de/i.test(txt);
                        if (pricesFound.length > 2 || !hasInstallments) {
                            candidates.add(link.href);
                        }
                    }
                });
            }

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
