const { parseProductLive } = require('./index');

/**
 * Searches and scrapes Live items by Name
 */
async function scrapeLiveByName(browser, driveItems, quota) {
    console.log(`\n🚙 INICIANDO SCRAPE LIVE BY NAME (${driveItems.length} itens)...`);

    // Deduplicate input items by name
    const uniqueItems = [];
    const seenNames = new Set();
    driveItems.forEach(item => {
        if (!seenNames.has(item.name)) {
            seenNames.add(item.name);
            uniqueItems.push(item);
        }
    });

    const collectedProducts = [];
    const page = await browser.newPage();

    try {
        await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded', timeout: 60000 });
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        // Wait for page to fully load including scripts
        console.log(`   ⏳ Aguardando página carregar completamente...`);
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
            console.log(`   ⚠️ Network idle timeout - prosseguindo mesmo assim`);
        });
        await page.waitForTimeout(3000);

        for (const item of uniqueItems) {
            if (collectedProducts.length >= quota) break;

            console.log(`\n🔍 Buscando por nome: "${item.name}"...`);

            try {
                // 1. Initial Page Load & Popup Handling
                console.log(`      🚙 Navegando para a home da Live...`);
                await page.goto('https://www.liveoficial.com.br/', { waitUntil: 'networkidle', timeout: 90000 });
                await page.waitForTimeout(3000);

                const closePopups = async () => {
                    const popupSelectors = [
                        'button.sc-f0c9328e-3',
                        'button[class*="close"]',
                        '.modal-close',
                        '[aria-label="Close"]',
                        'button:has-text("×")',
                        'button:has-text("Fechar")',
                        '.sc-f0c9328e-0 button',
                        '.modal-body button'
                    ];
                    for (const selector of popupSelectors) {
                        try {
                            const btns = page.locator(selector);
                            const count = await btns.count();
                            for (let i = 0; i < count; i++) {
                                const btn = btns.nth(i);
                                if (await btn.isVisible({ timeout: 500 })) {
                                    await btn.click({ force: true });
                                    console.log(`      ✅ Popup fechado: ${selector}`);
                                    await page.waitForTimeout(500);
                                }
                            }
                        } catch (e) { }
                    }
                };

                await closePopups();

                // 2. Interaction with search input
                console.log(`      🔎 Usando a barra de pesquisas para: "${item.name}"`);
                const searchInputSelector = 'input.bn-search__input';
                const searchButtonSelector = 'button.bn-search__submit';

                try {
                    await page.waitForSelector(searchInputSelector, { state: 'visible', timeout: 15000 });
                    const searchInput = page.locator(searchInputSelector).first();
                    await searchInput.scrollIntoViewIfNeeded();
                    await searchInput.click();
                    await page.waitForTimeout(500);

                    // Human-like typing
                    await searchInput.fill('');
                    await page.keyboard.type(item.name, { delay: 100 });
                    await page.waitForTimeout(1000);

                    // Try press Enter
                    await page.keyboard.press('Enter');

                    // Also try clicking the button if page doesn't change
                    const currentUrl = page.url();
                    await page.waitForTimeout(2000);
                    if (page.url() === currentUrl) {
                        console.log(`      🖱️ Clicando no botão de busca (Enter não mudou página)...`);
                        const searchBtn = page.locator(searchButtonSelector).first();
                        if (await searchBtn.isVisible()) {
                            await searchBtn.click();
                        }
                    }
                } catch (e) {
                    console.log(`      ⚠️ Falha ao interagir com a barra de busca: ${e.message}`);
                    await page.screenshot({ path: `debug/live_search_error_${item.name.replace(/ /g, '_')}.png` });
                    continue;
                }

                console.log(`      ⏳ Aguardando resultados...`);
                // Wait for any indicator of results or just a broad timeout
                await page.waitForTimeout(8000);
                await closePopups();

                // Find the product that matches the name
                const foundProductUrl = await page.evaluate(async (searchTerm) => {
                    const findLink = () => {
                        const links = Array.from(document.querySelectorAll('a[href]'));
                        console.log(`Debug: Total links found on page: ${links.length}`);

                        const searchWords = searchTerm.toLowerCase().split(' ').filter(w => w.length > 2);

                        const candidates = links.map(a => {
                            const url = a.getAttribute('href') || '';
                            const text = (a.innerText || '').toLowerCase().trim();
                            const title = (a.title || '').toLowerCase().trim();
                            const img = a.querySelector('img');
                            const imgAlt = img ? (img.alt || '').toLowerCase().trim() : '';

                            return {
                                fullUrl: a.href,
                                url: url,
                                combinedText: `${text} ${title} ${imgAlt}`.toLowerCase()
                            };
                        }).filter(c => {
                            // STRICT VTEX PRODUCT PATTERN: ends in /p or /p?
                            const isProd = c.url.match(/-[a-zA-Z0-9]{4,}\/p(\?|$)/) || c.url.includes('/p/');
                            if (!isProd) return false;

                            // Check for strict name match: at least 70% of words
                            let matches = 0;
                            searchWords.forEach(w => {
                                if (c.combinedText.includes(w)) matches++;
                            });

                            const matchRatio = matches / searchWords.length;
                            if (matchRatio >= 0.7) {
                                console.log(`Debug: Candidate found! Match: ${matchRatio.toFixed(2)} URL: ${c.fullUrl}`);
                                return true;
                            }
                            return false;
                        });

                        if (candidates.length === 0) return null;

                        // Score based on name matching
                        candidates.forEach(c => {
                            let score = 0;
                            searchWords.forEach(w => {
                                if (c.combinedText.includes(w)) score += 10;
                                if (c.fullUrl.toLowerCase().includes(w)) score += 5;
                            });
                            c.score = score;
                        });

                        candidates.sort((a, b) => b.score - a.score);
                        return candidates[0].fullUrl;
                    };

                    // Try immediate find
                    let link = findLink();
                    if (link) return link;

                    // Poll for 5 seconds
                    for (let i = 0; i < 5; i++) {
                        await new Promise(r => setTimeout(r, 1000));
                        link = findLink();
                        if (link) return link;
                    }
                    return null;
                }, item.name);

                if (!foundProductUrl) {
                    console.log(`      ⚠️ Nenhum produto encontrado para "${item.name}"`);
                    await page.screenshot({ path: `debug/live_results_fail_${item.name.replace(/ /g, '_')}.png` });
                    continue;
                }

                console.log(`      🔗 Navegando para o produto: ${foundProductUrl}`);
                await page.goto(foundProductUrl, { waitUntil: 'networkidle', timeout: 60000 });
                await page.waitForTimeout(5000);

                // 2. Extract Colors & Sizes
                // Restriction: Look only inside the product info container to avoid menu items
                const productInfoSelector = '.vtex-flex-layout-0-x-flexRowContent--product-main, .vtex-product-details-1-x-container, .product-info, main';

                // Helper to get sizes from current view
                const getSizes = async () => {
                    return await page.evaluate((infoSel) => {
                        const container = document.querySelector(infoSel) || document;
                        const sizes = [];
                        // Specifically look for SKU selector items
                        const allLis = Array.from(container.querySelectorAll('li[class*="sku"], li[class*="size"], li'));

                        // heuristic: text is standard size, no image child
                        const sizeLis = allLis.filter(li => {
                            const text = li.innerText.trim();
                            const hasImg = li.querySelector('img');
                            // Standard BR sizes + numeric
                            return !hasImg && text.length <= 5 && ['PP', 'P', 'M', 'G', 'GG', 'XG', 'U', 'ÚNICA', 'UNICA', '34', '36', '38', '40', '42', '44', '46'].includes(text.toUpperCase());
                        });

                        sizeLis.forEach(el => {
                            const params = el.innerText.trim();
                            const style = window.getComputedStyle(el);
                            const isCrossedOut = style.textDecoration.includes('line-through') ||
                                (style.opacity && Number(style.opacity) < 0.5) ||
                                el.className.includes('disabled') ||
                                el.className.includes('--unavailable') ||
                                el.className.includes('unavailable');

                            if (!isCrossedOut) {
                                sizes.push(params);
                            }
                        });
                        return [...new Set(sizes)]; // Unique sizes
                    }, productInfoSelector);
                };


                // Iterate Colors
                const colorElsHandle = await page.evaluateHandle((infoSel) => {
                    const container = document.querySelector(infoSel) || document;
                    const allLis = Array.from(container.querySelectorAll('li'));
                    return allLis.filter(li => {
                        const img = li.querySelector('img');
                        if (!img) return false;
                        // Color swatches are usually small and inside sku selector
                        const isSwatch = li.className.toLowerCase().includes('sku') ||
                            li.className.toLowerCase().includes('color') ||
                            (img.width < 100 && img.height < 100);
                        return isSwatch && !li.closest('header') && !li.closest('footer') && !li.closest('nav');
                    });
                }, productInfoSelector);

                // Get count safely
                const colorCount = await page.evaluate(lis => lis.length, colorElsHandle);
                console.log(`      🎨 ${colorCount} possíveis cores detectadas.`);

                let availableInfo = [];

                if (colorCount > 0) {
                    // We need to re-locate them as Playwright locators to click
                    // Use a selector that matches the logic
                    const possibleColors = page.locator('li').filter({ has: page.locator('img') });
                    const locatorCount = await possibleColors.count();

                    for (let i = 0; i < locatorCount; i++) {
                        const el = possibleColors.nth(i);

                        // Verify size again before clicking (Playwright locator check)
                        const box = await el.boundingBox();
                        if (!box || box.width > 120) continue; // Skip if large (gallery)

                        // Get Color Name FIRST
                        let colorName = `Cor ${i + 1}`;
                        const img = el.locator('img').first();
                        if (await img.count()) {
                            colorName = await img.getAttribute('alt') || await img.getAttribute('title') || colorName;
                        }

                        // Click Color
                        await el.click();
                        await page.waitForTimeout(1500); // Wait for sizes to update

                        const sizes = await getSizes();
                        if (sizes.length > 0) {
                            availableInfo.push(`${colorName}: ${sizes.join(' ')}`);
                        }
                    }
                } else {
                    // Single color
                    const sizes = await getSizes();
                    if (sizes.length > 0) {
                        availableInfo.push(`Única: ${sizes.join(' ')}`);
                    }
                }

                if (availableInfo.length === 0) {
                    console.log(`      ⚠️ Produto sem estoque (sem tamanhos detectados).`);
                    const content = await page.content();
                    const fs = require('fs');
                    fs.writeFileSync('debug/live_no_sizes.html', content);
                    console.log(`      📸 Dumped HTML to debug/live_no_sizes.html`);
                    continue;
                }

                // 3. Parse Base Data
                const productData = await parseProductLive(page, page.url());

                if (productData) {
                    // Update Sizes field with the Detailed String
                    // Ex: "rosa: P M G; azul: P"
                    productData.tamanhos = availableInfo; // Replacing array with Array of strings, or join them?
                    // Orchestrator expects array? Or string?
                    // 'tamanhos' usually is array of strings. 
                    // Let's store the raw detailed info in a new field 'grade_detalhada' ??
                    // User said: "pegar os tamanhos com base nas cores, ex: rosa: g gg pp"
                    // If I put this in 'tamanhos', it might break filters expecting ["P", "M"].
                    // But maybe for this specific "Live" feature, we want this string structure.

                    // Let's keep 'tamanhos' as the flat list of all sizes available (for consistency)
                    // and add 'observacao' or 'descricao' with the breakdown.

                    const allSizes = new Set();
                    availableInfo.forEach(s => {
                        const parts = s.split(':')[1].trim().split(' ');
                        parts.forEach(p => allSizes.add(p));
                    });
                    productData.tamanhos = [...allSizes];

                    // Add details to a custom field
                    productData.cor_tamanhos = availableInfo.join(' | ');

                    // Override ID with Drive File ID if real ID is weak? 
                    // No, use Real ID found on page for history tracking.
                    // But duplicates? User wants specific items from Drive.

                    productData.imageUrl = item.driveUrl; // Use Drive Image
                    productData.imagePath = item.driveUrl;
                    productData.isFavorito = item.isFavorito;

                    collectedProducts.push(productData);
                    console.log(`      ✅ Coletado: ${productData.nome} (${productData.cor_tamanhos})`);
                }

            } catch (err) {
                console.error(`      ❌ Erro ao processar item "${item.name}":`, err.message);
                await page.screenshot({ path: `debug/error_live_${item.name}.png` });
            }
        }

    } finally {
        await page.close();
    }

    return collectedProducts;
}

module.exports = { scrapeLiveByName };
