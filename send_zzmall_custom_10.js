const { initBrowser } = require('./browser_setup');
const { parseProductZZMall } = require('./scrapers/zzmall');
const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const { isDuplicate, markAsSent, normalizeId } = require('./historyManager');
const { processProductUrl, processImageDirect } = require('./imageDownloader');

async function sendZzMallItems() {
    console.log('🚀 Iniciando envio customizado ZZMall: 5 Sapatos + 5 Bolsas');

    const targetShoes = 5;
    const targetBags = 5;
    const collectedShoes = [];
    const collectedBags = [];

    const { browser, page } = await initBrowser();
    try {
        const promoUrl = 'https://www.zzmall.com.br/c/promocao';
        console.log(`💎 Visitando página de promoções: ${promoUrl}`);

        await page.goto(promoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        // Scroll profundo para pegar variedade
        console.log('📜 Rolando página para carregar produtos...');
        for (let i = 0; i < 20; i++) {
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(800);
        }

        const productUrls = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return [...new Set(anchors
                .map(a => a.href)
                .filter(url => {
                    if (!url) return false;
                    const isProd = (url.includes('/p/') || url.includes('/produto/'));
                    const isExcluded = url.includes('login') || url.includes('cart') || url.includes('checkout');
                    return isProd && !isExcluded;
                })
            )];
        });

        console.log(`🔎 Encontrados ${productUrls.length} links de produtos.`);

        // Embaralha para não pegar sempre os mesmos do topo se rodar várias vezes
        const shuffledUrls = productUrls.sort(() => Math.random() - 0.5);

        for (const url of shuffledUrls) {
            if (collectedShoes.length >= targetShoes && collectedBags.length >= targetBags) break;

            console.log(`🧐 Analisando: ${url}`);
            try {
                const product = await parseProductZZMall(page, url);

                if (!product) {
                    console.log('   ❌ Falha ao parsear (produto nulo)');
                    continue;
                }

                const normId = normalizeId(product.id);
                const duplicate = isDuplicate(normId);

                if (duplicate) {
                    console.log(`   ⏭️  Duplicado no histórico: ${normId} (Ignorando para priorizar novos)`);
                    // Por enquanto ignoramos, mas se faltar no final, poderíamos reativar
                    continue;
                }

                if (product.categoria === 'calçado' && collectedShoes.length < targetShoes) {
                    const success = await processAndAdd(product, url, collectedShoes, 'SHOE');
                    if (success) {
                        console.log(`   ✅ Sapato Coletado (${collectedShoes.length}/${targetShoes}): ${product.nome}`);
                    }
                } else if (product.categoria === 'bolsa' && collectedBags.length < targetBags) {
                    const success = await processAndAdd(product, url, collectedBags, 'BAG');
                    if (success) {
                        console.log(`   ✅ Bolsa Coletada (${collectedBags.length}/${targetBags}): ${product.nome}`);
                    }
                } else {
                    console.log(`   ℹ️  Categoria: ${product.categoria} (Não necessária agora)`);
                }
            } catch (err) {
                console.log(`   ❌ Erro durante análise: ${err.message}`);
            }
        }

        // Se ainda faltar itens, tentamos uma segunda passada permitindo duplicados
        if (collectedShoes.length < targetShoes || collectedBags.length < targetBags) {
            console.log('\n⚠️  Não foram encontrados itens novos suficientes. Tentando permitir duplicados...');
            for (const url of shuffledUrls) {
                if (collectedShoes.length >= targetShoes && collectedBags.length >= targetBags) break;

                const product = await parseProductZZMall(page, url);
                if (!product) continue;

                const alreadyCollected = [...collectedShoes, ...collectedBags].some(p => normalizeId(p.id) === normalizeId(product.id));
                if (alreadyCollected) continue;

                if (product.categoria === 'calçado' && collectedShoes.length < targetShoes) {
                    await processAndAdd(product, url, collectedShoes, 'SHOE (DUP)');
                } else if (product.categoria === 'bolsa' && collectedBags.length < targetBags) {
                    await processAndAdd(product, url, collectedBags, 'BAG (DUP)');
                }
            }
        }

        const allProducts = [...collectedShoes, ...collectedBags];
        if (allProducts.length > 0) {
            console.log(`\n📤 Enviando ${allProducts.length} itens para o webhook padrão...`);
            const result = await sendToWebhook(allProducts);
            if (result.success) {
                console.log('✅ Tudo enviado com sucesso!');
            } else {
                console.error('❌ Falha no envio:', result.error);
            }
        } else {
            console.log('❌ Nenhum item pôde ser coletado.');
        }

    } catch (e) {
        console.error('❌ Erro global:', e.message);
    } finally {
        if (browser) await browser.close();
    }
}

async function processAndAdd(product, url, targetArray, logLabel) {
    try {
        product.url = url.includes('?') ? `${url}&influ=cupomdafran` : `${url}?influ=cupomdafran`;
        product.loja = 'zzmall';
        product.desconto = (product.precoOriginal || 0) - (product.precoAtual || 0);
        if (product.desconto < 0) product.desconto = 0;

        // Image download
        let imagePath = null;
        try {
            const imgResult = product.imageUrl ?
                await processImageDirect(product.imageUrl, 'ZZMALL', product.id) :
                await processProductUrl(url, product.id);

            if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) {
                imagePath = imgResult.cloudinary_urls[0];
            }
        } catch (err) {
            console.log(`      🖼️ Erro imagem: ${err.message}`);
        }

        product.imagePath = imagePath;
        product.message = buildZzMallMessage(product);

        // Marcar como enviado no histórico
        markAsSent([product.id]);
        targetArray.push(product);
        return true;
    } catch (e) {
        console.error(`      ❌ Erro processAndAdd: ${e.message}`);
        return false;
    }
}

sendZzMallItems();
