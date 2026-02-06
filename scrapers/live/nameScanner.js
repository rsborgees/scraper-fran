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
        await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded', timeout: 90000 });

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
                // --- STRATEGY: Try Full Name First ---
                console.log(`\n   🔍 Tentando busca por NOME COMPLETO: "${item.name}"`);

                let bestMatch = null;

                // Em servidor (Linux), usar sempre URL direta (mais confiável)
                const useDirectUrl = process.platform === 'linux';

                try {
                    if (useDirectUrl) {
                        console.log('      🔄 Servidor detectado: usando URL direta...');
                        await page.goto(`https://www.liveoficial.com.br/busca?pesquisa=${encodeURIComponent(item.name)}`, {
                            waitUntil: 'domcontentloaded',
                            timeout: 90000
                        });
                        await page.waitForTimeout(15000);
                        await closePopups();
                    } else {
                        // Local: tentar campo de busca
                        const searchInputSelector = 'input.bn-search__input, .search-input, input[type="search"]';
                        const searchInput = page.locator(searchInputSelector).first();

                        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                            await searchInput.click();
                            await page.waitForTimeout(500);
                            await searchInput.fill('');
                            await searchInput.type(item.name, { delay: 30 });
                            await page.waitForTimeout(500);
                            await page.keyboard.press('Enter');
                            await page.waitForTimeout(15000);
                            await closePopups();
                        } else {
                            throw new Error('Campo de busca não visível');
                        }
                    }

                    const candidates = await page.evaluate((name) => {
                        const links = Array.from(document.querySelectorAll('a[href]'));
                        return links.filter(a => {
                            const href = a.href.toLowerCase();
                            return (href.includes('/p') || href.includes('/p/')) &&
                                !['/carrinho', '/login', '/checkout', '/conta', '/atendimento'].some(s => href.includes(s));
                        }).map(a => {
                            const text = (a.innerText || '').toLowerCase().trim();
                            const target = name.toLowerCase().trim();
                            let score = 0;

                            const cleanText = text.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
                            const cleanTarget = target.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

                            if (cleanText === cleanTarget) score += 100;
                            else if (cleanText.includes(cleanTarget) || cleanTarget.includes(cleanText)) score += 50;

                            const targetWords = cleanTarget.split(' ').filter(w => w.length > 2);
                            targetWords.forEach(w => { if (cleanText.includes(w)) score += 20; });

                            return { url: a.href, score, text };
                        }).sort((a, b) => b.score - a.score);
                    }, item.name);

                    if (candidates.length > 0 && candidates[0].score > 60) {
                        bestMatch = candidates[0].url;
                        console.log(`      ✅ Sucesso com nome completo: "${candidates[0].text}" (Score: ${candidates[0].score})`);
                    } else {
                        console.log(`      ⚠️ Nenhum match bom encontrado. Melhor score: ${candidates[0]?.score || 0}`);
                        console.log(`      📊 Total de candidatos: ${candidates.length}`);
                    }
                } catch (e) {
                    console.log(`      ⚠️ Erro na busca por nome completo: ${e.message}`);
                }


                if (bestMatch) {
                    const partialData = await parseProductLive(page, bestMatch);
                    if (partialData) {
                        const finalProduct = {
                            id: partialData.id,
                            nome: item.name,
                            preco: partialData.preco,
                            preco_original: partialData.preco_original,
                            tamanhos: partialData.tamanhos,
                            url: bestMatch,
                            imageUrl: item.driveUrl,
                            imagePath: item.driveUrl,
                            loja: 'live',
                            isSet: false
                        };
                        collectedProducts.push(finalProduct);
                        const { markAsSent } = require('../../historyManager');
                        markAsSent([finalProduct.id]);
                        continue;
                    }
                }

                // --- FALLBACK: Composite Search (Only if full name search failed) ---
                console.log(`\n   🧩 Nome completo não encontrou match direto. Tentando busca composta...`);
                const searchParts = item.searchParts || [item.name];
                const compositeResults = [];

                for (const partName of searchParts) {
                    console.log(`\n      🧩 Processando parte: "${partName}"`);
                    // ... (rest of search logic remains the same)
                    const queriesToTry = [partName];
                    const words = partName.toLowerCase().split(' ');
                    if (words.length > 3) queriesToTry.push(words.slice(0, words.length - 1).join(' '));

                    let foundProductUrl = null;
                    for (const query of queriesToTry) {
                        // Sempre usar URL direta em servidor
                        console.log(`         🔍 Buscando: "${query}"`);
                        await page.goto(`https://www.liveoficial.com.br/busca?pesquisa=${encodeURIComponent(query)}`, {
                            waitUntil: 'domcontentloaded',
                            timeout: 90000
                        });
                        await page.waitForTimeout(12000);
                        await closePopups();

                        const candidates = await page.evaluate((originalPartName) => {
                            const colorMap = { 'branco': 'white', 'preto': 'black', 'azul': 'blue', 'verde': 'green', 'amarelo': 'yellow', 'cinza': 'gray' };
                            const links = Array.from(document.querySelectorAll('a[href]')).filter(a => (a.href.includes('/p') || a.href.includes('/p/')));
                            return links.map(a => {
                                const text = (a.innerText || '').toLowerCase();
                                const target = originalPartName.toLowerCase();
                                let score = 0;
                                if (text.includes(target)) score += 50;
                                target.split(' ').forEach(w => { if (text.includes(w)) score += 10; });
                                return { url: a.href, score, text };
                            }).sort((a, b) => b.score - a.score);
                        }, partName);

                        if (candidates.length > 0 && candidates[0].score > 20) {
                            foundProductUrl = candidates[0].url;
                            break;
                        }
                    }

                    if (foundProductUrl) {
                        const partialData = await parseProductLive(page, foundProductUrl);
                        if (partialData) {
                            compositeResults.push({ id: partialData.id, name: partialData.nome, price: partialData.preco, origPrice: partialData.preco_original, sizes: partialData.tamanhos, url: foundProductUrl });
                        }
                    } else {
                        compositeResults.push({ notFound: true });
                    }
                }

                // Check if any part was not found
                if (compositeResults.some(r => r.notFound)) {
                    console.log(`      ⚠️ Conjunto ignorado pois um dos itens não foi encontrado.`);
                    continue;
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
