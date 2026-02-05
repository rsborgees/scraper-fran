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

            // Basic composite detection using keywords
            // e.g. "Top ... Shorts ..."
            const keywords = ['Top', 'Shorts', 'Legging', 'Blusa', 'Regata', 'Saia', 'Vestido', 'Macacão', 'Body', 'Bermuda', 'Calça', 'T-Shirt', 'Jaqueta', 'Casaco', 'Macaquinho'];
            const lowerName = item.name.toLowerCase();
            let splitIndices = [];

            keywords.forEach(kw => {
                const kwLow = kw.toLowerCase();
                let idx = lowerName.indexOf(kwLow);
                while (idx !== -1) {
                    // Only count if it's the start of the string OR preceded by space/separator
                    // And checking if we haven't already marked this index
                    if ((idx === 0 || /[\s\-]/.test(lowerName[idx - 1])) && !splitIndices.includes(idx)) {
                        splitIndices.push(idx);
                    }
                    idx = lowerName.indexOf(kwLow, idx + 1);
                }
            });

            splitIndices.sort((a, b) => a - b);

            // Dedupe close indices (in case of "Top Curve" vs "Top")
            // Not needed if keywords are distinct enough, but "Top" is short.

            let parts = [];
            if (splitIndices.length > 1) {
                for (let i = 0; i < splitIndices.length; i++) {
                    let start = splitIndices[i];
                    let end = splitIndices[i + 1] || item.name.length;
                    parts.push(item.name.substring(start, end).trim());
                }
            } else {
                parts.push(item.name);
            }

            // Store parts in item for processing
            item.searchParts = parts;
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
                // --- COMPOSITE SEARCH LOOP ---
                const searchParts = item.searchParts || [item.name];
                const compositeResults = [];

                for (const partName of searchParts) {
                    console.log(`\n   🧩 Processando parte do conjunto: "${partName}"`);

                    const searchInputSelector = 'input.bn-search__input, .search-input, input[type="search"]';
                    // The user said the name in the Drive file is EXACTLY like in Live!
                    // So we use it as is, but clean special chars for the search engine if needed.
                    const cleanName = partName.toLowerCase()
                        .replace(/icon/g, '')
                        .replace(/favorito/g, '')
                        .replace(/[!@#$%^&*(),.?":{}|<>]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    const queriesToTry = [cleanName];
                    const words = cleanName.split(' ');

                    // Progressive fallback just in case, but prioritize the full string
                    if (words.length > 3) {
                        queriesToTry.push(words.slice(0, words.length - 1).join(' '));
                    }

                    let foundProductUrl = null;
                    let bestMatchedId = null;

                    for (const query of queriesToTry) {
                        console.log(`      🔎 Tentando busca com: "${query}"`);

                        try {
                            const searchInput = page.locator(searchInputSelector).first();
                            if (await searchInput.isVisible()) {
                                await searchInput.click();
                                await page.waitForTimeout(500);
                                await searchInput.fill('');
                                await searchInput.type(query, { delay: 30 });
                                await page.waitForTimeout(500);
                                await page.keyboard.press('Enter');
                            } else {
                                throw new Error("Search input hidden");
                            }
                        } catch (e) {
                            const searchUrl = `https://www.liveoficial.com.br/busca?q=${encodeURIComponent(query)}`;
                            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        }

                        await page.waitForTimeout(5000);
                        await closePopups();

                        const candidates = await page.evaluate((originalFullName) => {
                            const colorMap = {
                                'branco': 'white',
                                'preto': 'black',
                                'azul': 'blue',
                                'verde': 'green',
                                'amarelo': 'yellow',
                                'cinza': 'gray',
                                'grafite': 'graphite',
                                'vermelho': 'red',
                                'rosa': 'pink',
                                'roxo': 'purple',
                                'laranja': 'orange',
                                'marrom': 'brown',
                                'bege': 'beige',
                                'marinho': 'navy'
                            };

                            const links = Array.from(document.querySelectorAll('a[href]'));
                            const productLinks = links.filter(a => {
                                const href = a.href.toLowerCase();
                                return (href.includes('/p') || href.includes('/p/')) &&
                                    !['/carrinho', '/login', '/checkout', '/conta', '/atendimento'].some(s => href.includes(s));
                            });

                            if (productLinks.length === 0) return [];

                            const target = originalFullName.toLowerCase().replace(/!/g, '').trim();
                            const targetWords = target.split(' ').filter(w => w.length > 2);

                            // Find requested colors in target
                            const requestedColors = Object.keys(colorMap).filter(c => target.includes(c));
                            const translatedColors = requestedColors.map(c => colorMap[c]);

                            return productLinks.map(a => {
                                // Find the parent card to look for images and better text
                                let card = a.parentElement;
                                while (card && card.tagName !== 'BODY' && !card.querySelector('img')) {
                                    card = card.parentElement;
                                }

                                const img = card ? card.querySelector('img') : null;
                                const altText = img ? (img.alt || '').toLowerCase() : '';
                                const text = (a.innerText || '').toLowerCase().trim();
                                const url = a.href.toLowerCase();
                                let score = 0;

                                // 1. EXACT MATCH BONUS (Text or Alt)
                                if (text === target || altText === target) score += 100;
                                else if (text.includes(target) || altText.includes(target)) score += 50;

                                // 2. Word by word matching (Text + Alt + URL)
                                let matchCount = 0;
                                targetWords.forEach(w => {
                                    let matched = false;
                                    if (text.includes(w)) { score += 20; matched = true; }
                                    if (altText.includes(w)) { score += 20; matched = true; }
                                    if (url.includes(w)) { score += 5; matched = true; }

                                    if (matched) matchCount++;

                                    // Special handle for color translation in URL
                                    if (colorMap[w] && url.includes(colorMap[w])) {
                                        score += 25; // High bonus for translated color in URL
                                    }
                                });

                                // 3. Penalty for EXTRA words in text (avoids "Sense Pro" if not in query)
                                const candidateWords = text.split(/\s+/).filter(w => w.length > 2);
                                candidateWords.forEach(w => {
                                    if (!targetWords.includes(w)) {
                                        score -= 20;
                                    }
                                });

                                // 4. Penalty for words in URL that are NOT in target and are NOT color
                                const urlParts = url.split(/[\-\/]/).filter(p => p.length > 3 && !['product', 'liveoficial', 'com', 'br'].includes(p));
                                urlParts.forEach(p => {
                                    if (!targetWords.includes(p) && !translatedColors.includes(p)) {
                                        if (!p.match(/^[a-z]\d+|^\d+/)) {
                                            score -= 5;
                                        }
                                    }
                                });

                                // 5. Final tie breaker
                                if (matchCount === targetWords.length) score += 30;

                                return { url: a.href, score, text: text || altText };
                            }).sort((a, b) => b.score - a.score);
                        }, cleanName);

                        if (candidates.length > 0 && candidates[0].score > 20) {
                            foundProductUrl = candidates[0].url;
                            console.log(`      ✅ Melhor match: "${candidates[0].text}" (Score: ${candidates[0].score})`);
                            break;
                        }
                    }

                    if (foundProductUrl) {
                        console.log(`      Found: ${foundProductUrl}`);
                        await page.goto(foundProductUrl, { waitUntil: 'domcontentloaded' });
                        await page.waitForTimeout(3000);

                        const partialData = await parseProductLive(page, foundProductUrl);

                        if (partialData) {
                            compositeResults.push({
                                id: partialData.id,
                                name: partialData.nome,
                                price: partialData.preco,
                                origPrice: partialData.preco_original,
                                sizes: partialData.tamanhos,
                                url: foundProductUrl
                            });
                        }
                    } else {
                        compositeResults.push({
                            id: 'unknown_' + Date.now(),
                            name: partName,
                            notFound: true,
                            price: 0,
                            sizes: [],
                            url: ""
                        });
                    }
                }

                // Check if any part was not found
                const hasMissingPart = compositeResults.some(r => r.notFound);
                if (hasMissingPart) {
                    console.log(`      ⚠️ Conjunto ignorado pois um dos itens não foi encontrado: ${item.name}`);
                    continue; // Skip this whole set
                }

                // MERGE RESULTS
                if (compositeResults.length > 0) {
                    const allSizes = new Set();
                    compositeResults.forEach(r => r.sizes.forEach(s => allSizes.add(s)));

                    const mainProduct = {
                        id: compositeResults.map(r => r.id).join('_'),
                        nome: item.name, // Use the original name from Drive
                        items: compositeResults.map(r => ({
                            nome: r.name,
                            preco: r.price,
                            preco_original: r.origPrice || r.price,
                            tamanhos: r.sizes,
                            url: r.url
                        })),
                        preco: compositeResults.reduce((sum, r) => sum + r.price, 0),
                        preco_original: compositeResults.reduce((sum, r) => sum + (r.origPrice || r.price), 0),
                        tamanhos: [...allSizes],
                        url: compositeResults.filter(r => r.url).map(r => r.url)[0] || "",
                        imageUrl: item.driveUrl,
                        imagePath: item.driveUrl,
                        loja: 'live',
                        isSet: compositeResults.length > 1
                    };

                    collectedProducts.push(mainProduct);
                    const { markAsSent } = require('../../historyManager');
                    markAsSent([mainProduct.id]);
                    console.log(`      ✅ Conjunto Coletado com ${compositeResults.length} itens.`);
                }

                // End of loop item processing, skip original logic
                continue;



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
