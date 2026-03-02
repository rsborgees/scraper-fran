const { initBrowser } = require('../../browser_setup');
const fs = require('fs');
const path = require('path');
const { processProductUrl, processImageDirect } = require('../../imageDownloader');
const { checkFarmTimer } = require('./timer_check');
const { isDuplicate, markAsSent } = require('../../historyManager');

/**
 * Scraper FARM - Isolado e Otimizado
 * @param {number} quota - Meta de produtos
 * @param {boolean} dryRun - Se true, não salva no banco nem baixa imagens
 */
async function scrapeFarm(quota = 84, dryRun = false, parentBrowser = null) {
    console.log(`\n🌸 INICIANDO SCRAPER FARM (Quota: ${quota}, DryRun: ${dryRun})`);

    const CATEGORIES = [
        { name: 'Novidades', url: 'https://www.farmrio.com.br/novidades' },
        { name: 'Vestidos', url: 'https://www.farmrio.com.br/vestido' },
        { name: 'Macacões', url: 'https://www.farmrio.com.br/macacao' },
        { name: 'Conjuntos', url: 'https://www.farmrio.com.br/conjunto' },
        { name: 'Saias', url: 'https://www.farmrio.com.br/saia' },
        { name: 'Shorts', url: 'https://www.farmrio.com.br/short' },
        { name: 'Blusas', url: 'https://www.farmrio.com.br/blusa' }
    ];

    console.log('⏳ Verificando status do reloginho/cupom...');
    let timerData = null;
    try {
        timerData = await checkFarmTimer();
    } catch (e) { console.error('Error checking timer:', e); }

    const confirmedPromotions = [];
    const seenInRun = new Set();

    // Importa funções auxiliares locais
    const { scanCategory } = require('./scanner');
    const { parseProduct } = require('./parser');
    const { normalizeId } = require('../../historyManager');

    // 🚀 Browser Management
    let browser, page;
    let shouldCloseBrowser = false;

    if (parentBrowser) {
        browser = parentBrowser;
        page = await browser.newPage();
    } else {
        ({ browser, page } = await initBrowser());
        shouldCloseBrowser = true;
    }

    try {
        for (const cat of CATEGORIES) {
            if (confirmedPromotions.length >= quota) {
                console.log(`✅ Quota GERAL atingida (${confirmedPromotions.length}/${quota}). Finalizando.`);
                break;
            }

            console.log(`\n📂 Categoria: ${cat.name}`);

            // Configuração por categoria
            let targetForCategory = 1;
            if (cat.name === 'Vestidos') targetForCategory = Math.floor(quota * 0.70) || 1;
            if (cat.name === 'Macacões') targetForCategory = Math.round(quota * 0.10) || 1;
            if (targetForCategory < 1) targetForCategory = 1;

            let itemsFoundInCategory = 0;
            let pageNum = 1;
            let consecEmptyPages = 0;
            const maxPages = 50; // Limite de segurança

            while (itemsFoundInCategory < targetForCategory && pageNum <= maxPages) {
                // Monta URL paginada (com delay progressivo se precisar)
                // Usando /produtos/categoria?page=X format
                // Se a cat.url já for /vestido, transformar em /produtos/vestido para paginar
                let pageUrl = cat.url;

                // Normaliza URL para suportar paginação padrão da VTEX/Linx (?page=X)
                // Farm: https://www.farmrio.com.br/vestido -> https://www.farmrio.com.br/produtos/vestido?page=X
                if (!pageUrl.includes('/produtos/')) {
                    const slug = pageUrl.split('.br/')[1];
                    pageUrl = `https://www.farmrio.com.br/produtos/${slug}`;
                }

                const currentUrl = `${pageUrl}?page=${pageNum}`;
                console.log(`   📄 Página ${pageNum}: ${currentUrl}`);

                try {
                    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

                    // Scroll leve para trigger lazy load
                    await page.evaluate(async () => {
                        window.scrollBy(0, 600);
                        await new Promise(r => setTimeout(r, 500));
                        window.scrollBy(0, 600);
                    });
                    await page.waitForTimeout(2000); // Wait for grid render

                    // Coleta URLs da página atual
                    const pageProductUrls = await page.evaluate(() => {
                        // Seletor mais abrangente, pegando /p no final
                        const anchors = Array.from(document.querySelectorAll('a'));
                        return [...new Set(anchors
                            .map(a => a.href)
                            .filter(href => (href.includes('/p?') || href.includes('/p/') || href.endsWith('/p')) && !href.includes('login') && !href.includes('cart') && !href.includes('wishlist'))
                        )];
                    });

                    if (pageProductUrls.length === 0) {
                        console.log('      ⚠️ Nenhum produto encontrado nesta página.');
                        consecEmptyPages++;
                        if (consecEmptyPages >= 10) {
                            console.log('      🛑 10 páginas vazias seguidas. Próxima categoria.');
                            break;
                        }
                    } else {
                        consecEmptyPages = 0;
                        console.log(`      🔎 Analisando ${pageProductUrls.length} produtos na página ${pageNum}...`);

                        for (const url of pageProductUrls) {
                            if (confirmedPromotions.length >= quota) break;
                            if (itemsFoundInCategory >= targetForCategory) break;

                            // Check ID na URL - Captura código completo incluindo cor
                            const idMatch = url.match(/(\d{6,}[_-]\d+|\d{6,})/);
                            let earlyId = idMatch ? idMatch[1] : null;
                            // Se não tiver ID numérico na URL, tenta extrair do slug (menos confiável, mas ok para skip)

                            const normEarlyId = earlyId ? normalizeId(earlyId) : null;
                            if (normEarlyId && (seenInRun.has(normEarlyId) || isDuplicate(normEarlyId))) {
                                // console.log(`      ⏭️  Skip ID ${normEarlyId}`);
                                continue;
                            }

                            // Parse Real
                            const product = await parseProduct(page, url);

                            if (product) {
                                // STRICT FILTER: Block non-clothing categories
                                const forbiddenCategories = ['acessório', 'mala', 'bolsa', 'banho', 'utilitário/casa', 'desconhecido'];
                                if (forbiddenCategories.includes(product.categoria)) {
                                    console.log(`      🚫 Descartado (Categoria Proibida/Não Permitida): ${product.categoria} - ${product.nome}`);
                                    continue;
                                }

                                const normId = normalizeId(product.id);
                                // Farm Regular: 168h (7 dias)
                                if (seenInRun.has(normId) || isDuplicate(normId, { maxAgeHours: 168 }, product.preco)) continue;

                                seenInRun.add(normId);


                                // Image Download
                                let imagePath = null;
                                if (!dryRun) {
                                    try {
                                        let imgResult = product.imageUrl ?
                                            await processImageDirect(product.imageUrl, 'FARM', product.id) :
                                            await processProductUrl(url, product.id);
                                        if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) imagePath = imgResult.cloudinary_urls[0];
                                    } catch (e) { }
                                }

                                const { appendQueryParams } = require('../../urlUtils');
                                product.url = appendQueryParams(url, { utm_campaign: "7B1313" });
                                product.loja = 'farm';
                                product.imagePath = imagePath || 'error.jpg';
                                product.timerData = timerData;

                                // NEW: Flag as Novidade for prioritization
                                if (cat.name === 'Novidades') {
                                    product.isNovidade = true;
                                }

                                confirmedPromotions.push(product);
                                itemsFoundInCategory++;
                                console.log(`      ✅ [${itemsFoundInCategory}/${targetForCategory}] Capturado: ${product.nome}`);
                            }
                        }
                    }

                } catch (errPage) {
                    console.log(`      ⚠️ Erro ao acessar página ${pageNum}: ${errPage.message}`);
                    consecEmptyPages++;
                }

                pageNum++;
                // Pequeno delay para não bombardear o servidor
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    } catch (error) {
        console.error('❌ Erro crítico no Scraper Farm:', error.message);
    } finally {
        if (shouldCloseBrowser) {
            await browser.close();
            console.log('🔓 Navegador Farm encerrado.');
        } else {
            if (page) await page.close();
            console.log('🔓 Página Farm fechada.');
        }
    }

    // Ordenação e Distribuição Final
    confirmedPromotions.sort((a, b) => (b.precoOriginal - b.precoAtual) - (a.precoOriginal - a.precoAtual));

    const selectedProducts = confirmedPromotions.slice(0, quota);

    console.log(`\n✅ FARM FINAL: ${selectedProducts.length}/${quota} produtos capturados.`);
    return selectedProducts;
}

module.exports = { scrapeFarm };
