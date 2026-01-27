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
        console.log(`      🚙 Navegando para a home da Live...`);
        await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded', timeout: 60000 });

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
                            await page.waitForTimeout(501);
                        }
                    }
                } catch (e) { }
            }
        };

        await closePopups();

        for (const item of uniqueItems) {
            if (collectedProducts.length >= quota) break;

            console.log(`\n🔍 Buscando por nome: "${item.name}"...`);

            try {
                const searchInputSelector = 'input.bn-search__input, .search-input, input[type="search"]';
                const cleanQuery = item.name.toLowerCase()
                    .replace(/live!/g, '')
                    .replace(/live/g, '')
                    .replace(/icon/g, '')
                    .replace(/favorito/g, '')
                    .replace(/[!@#$%^&*(),.?":{}|<>]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                try {
                    await page.waitForSelector(searchInputSelector, { state: 'visible', timeout: 8000 });
                    const searchInput = page.locator(searchInputSelector).first();
                    await searchInput.click();
                    const waitTime = 1000;
                    await page.waitForTimeout(waitTime);

                    console.log(`      🔎 Digitando busca: "${cleanQuery}"`);
                    await searchInput.fill('');
                    await searchInput.type(cleanQuery, { delay: 50 });
                    await page.waitForTimeout(1000);
                    await page.keyboard.press('Enter');
                } catch (e) {
                    console.log(`      ⚠️ Busca via input falhou, tentando URL direta...`);
                    const searchUrl = `https://www.liveoficial.com.br/busca?q=${encodeURIComponent(cleanQuery)}`;
                    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                }

                await page.waitForTimeout(7000);
                await closePopups();

                console.log(`      ⏳ Analisando candidatos...`);
                const foundProductUrl = await page.evaluate((searchTerm) => {
                    const links = Array.from(document.querySelectorAll('a[href]'));
                    const searchTermLower = searchTerm.toLowerCase();
                    const searchWords = searchTermLower.split(' ').filter(w => w.length > 2);

                    const candidates = links.map(a => {
                        const url = a.getAttribute('href') || '';
                        const text = (a.innerText || '').toLowerCase().trim();
                        const title = (a.title || '').toLowerCase().trim();
                        return { fullUrl: a.href, url: url, text: `${text} ${title}`.toLowerCase() };
                    }).filter(c => {
                        const isProd = c.url.match(/-[a-zA-Z0-9]{4,}\/p(\?|$)/) || c.url.includes('/p/');
                        if (!isProd) return false;
                        const productWords = c.text.split(/\s+/).filter(w => w.length > 3);
                        return productWords.some(pw => searchTermLower.includes(pw));
                    });

                    if (candidates.length === 0) return null;

                    candidates.forEach(c => {
                        let score = 0;
                        searchWords.forEach(w => {
                            if (c.text.includes(w)) score += 10;
                            if (c.fullUrl.toLowerCase().includes(w)) score += 5;
                        });
                        c.score = score;
                    });
                    candidates.sort((a, b) => b.score - a.score);
                    return candidates[0].fullUrl;
                }, item.name);

                if (!foundProductUrl) {
                    console.log(`      ⚠️ Nenhum produto encontrado para "${item.name}"`);
                    continue;
                }

                console.log(`      🔗 Navegando para o produto: ${foundProductUrl}`);
                await page.goto(foundProductUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(5000);

                const getSizes = async () => {
                    return await page.evaluate(() => {
                        const productInfoSelector = '.vtex-flex-layout-0-x-flexRowContent--product-main, .vtex-product-details-1-x-container, .product-info, main';
                        const container = document.querySelector(productInfoSelector) || document;
                        const finalSizes = [];
                        const validSizeNames = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'U', 'ÚNICA', 'UNICA', '34', '36', '38', '40', '42', '44', '46'];

                        validSizeNames.forEach(sizeName => {
                            const elements = Array.from(container.querySelectorAll('li, div, label, span, button'))
                                .filter(el => (el.innerText || '').trim().toUpperCase() === sizeName);

                            if (elements.length > 0) {
                                const isSomeOutOfStock = elements.some(el => {
                                    const style = window.getComputedStyle(el);
                                    const parentStyle = el.parentElement ? window.getComputedStyle(el.parentElement) : { backgroundImage: '', opacity: '1', textDecoration: '' };

                                    const hasSvg = style.backgroundImage.includes('svg') ||
                                        style.backgroundImage.includes('data:image') ||
                                        parentStyle.backgroundImage.includes('svg') ||
                                        parentStyle.backgroundImage.includes('data:image') ||
                                        Array.from(el.querySelectorAll('*')).some(child => {
                                            const s = window.getComputedStyle(child);
                                            return s.backgroundImage.includes('svg') || s.backgroundImage.includes('data:image');
                                        });

                                    const isDisabled = style.textDecoration.includes('line-through') ||
                                        parentStyle.textDecoration.includes('line-through') ||
                                        hasSvg ||
                                        (style.opacity && Number(style.opacity) < 0.6) ||
                                        (parentStyle.opacity && Number(parentStyle.opacity) < 0.6) ||
                                        el.className.toLowerCase().includes('disable') ||
                                        el.className.toLowerCase().includes('unavailable') ||
                                        (el.parentElement && el.parentElement.className.toLowerCase().includes('unavailable')) ||
                                        el.getAttribute('aria-disabled') === 'true';

                                    return isDisabled;
                                });

                                if (!isSomeOutOfStock) {
                                    finalSizes.push(sizeName);
                                }
                            }
                        });
                        return finalSizes;
                    });
                };

                const possibleColors = page.locator('img[src*="/color/"], .vtex-sku-selector-1-x-item img, [class*="sku"] img');
                const locatorCount = await possibleColors.count();
                let availableInfo = [];

                if (locatorCount > 0 && locatorCount < 20) {
                    console.log(`      🎨 Cores detectadas: ${locatorCount}`);
                    for (let i = 0; i < locatorCount; i++) {
                        const img = possibleColors.nth(i);
                        if (!(await img.isVisible())) continue;
                        await img.scrollIntoViewIfNeeded();

                        const alt = await img.getAttribute('alt');
                        const src = await img.getAttribute('src');
                        let colorName = alt || `Cor ${i + 1}`;

                        if (alt && /whatsapp|transparent|stamp|bojo|bolso|care|prote|compres/i.test(alt)) continue;
                        if (src && /whatsapp|stamp/i.test(src)) continue;

                        console.log(`      🖱️ Clicando na cor: ${colorName}`);
                        await img.click({ force: true });
                        await page.waitForTimeout(3500);

                        const sizes = await getSizes();
                        if (sizes.length > 0) {
                            availableInfo.push(`${colorName}: ${sizes.join(' ')}`);
                        }
                    }
                } else {
                    const sizes = await getSizes();
                    if (sizes.length > 0) availableInfo.push(`Única: ${sizes.join(' ')}`);
                }

                if (availableInfo.length === 0) {
                    console.log(`      ⚠️ Produto sem estoque.`);
                    continue;
                }

                const productData = await parseProductLive(page, page.url());
                if (productData) {
                    const allSizes = new Set();
                    availableInfo.forEach(s => {
                        const parts = s.split(':')[1].trim().split(' ');
                        parts.forEach(p => allSizes.add(p));
                    });
                    productData.tamanhos = [...allSizes];
                    productData.cor_tamanhos = availableInfo.join('\n');
                    productData.imageUrl = item.driveUrl;
                    productData.imagePath = item.driveUrl;
                    productData.isFavorito = item.isFavorito;
                    productData.loja = 'live';
                    productData.precoAtual = productData.preco;
                    productData.precoOriginal = productData.preco_original || productData.preco;

                    collectedProducts.push(productData);
                    console.log(`      ✅ Coletado: ${productData.nome} (${productData.cor_tamanhos})`);

                    const { markAsSent } = require('../../historyManager');
                    markAsSent([productData.id]);
                }

                await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded' });
                await closePopups();

            } catch (err) {
                console.error(`      ❌ Erro ao processar "${item.name}":`, err.message);
            }
        }
    } finally {
        await page.close();
    }

    return collectedProducts;
}

module.exports = { scrapeLiveByName };
