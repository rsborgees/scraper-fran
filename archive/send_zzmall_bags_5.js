const { initBrowser } = require('./browser_setup');
const { parseProductZZMall } = require('./scrapers/zzmall');
const { buildZzMallMessage } = require('./messageBuilder');
const { sendToWebhook } = require('./cronScheduler');
const { markAsSent, normalizeId } = require('./historyManager');
const { processProductUrl, processImageDirect } = require('./imageDownloader');

async function sendBags() {
    console.log('🚀 Enviando 5 Bolsas ZZMall...');

    const targetBags = 5;
    const collectedBags = [];

    const { browser, page } = await initBrowser();
    try {
        // URL específica de Bolsas em Promoção
        const promoUrl = 'https://www.zzmall.com.br/c/promocao?q=:relevance:fullCategoryTree:ACESSORIOS;BOLSAS';
        console.log(`💎 Visitando página de promoções de BOLSAS: ${promoUrl}`);

        await page.goto(promoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        // Scroll
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(800);
        }

        const productUrls = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return [...new Set(anchors
                .map(a => a.href)
                .filter(url => url && (url.includes('/p/') || url.includes('/produto/')) && !/login|cart|checkout/.test(url))
            )];
        });

        console.log(`🔎 Encontrados ${productUrls.length} links.`);

        for (const url of productUrls) {
            if (collectedBags.length >= targetBags) break;

            console.log(`🧐 Analisando: ${url}`);
            const product = await parseProductZZMall(page, url);

            if (product && product.categoria === 'bolsa') {
                product.url = url.includes('?') ? `${url}&influ=cupomdafran` : `${url}?influ=cupomdafran`;
                product.loja = 'zzmall';
                product.desconto = (product.precoOriginal || 0) - (product.precoAtual || 0);

                console.log(`🖼️ Baixando imagem para ${product.id}`);
                let imagePath = null;
                try {
                    const imgResult = product.imageUrl ?
                        await processImageDirect(product.imageUrl, 'ZZMALL', product.id) :
                        await processProductUrl(url, product.id);

                    if (imgResult.status === 'success' && imgResult.cloudinary_urls?.length > 0) {
                        imagePath = imgResult.cloudinary_urls[0];
                    }
                } catch (err) { }

                product.imagePath = imagePath;
                product.message = buildZzMallMessage(product);

                markAsSent([product.id]);
                collectedBags.push(product);
                console.log(`   ✅ Bolsa Coletada (${collectedBags.length}/${targetBags}): ${product.nome}`);
            }
        }

        if (collectedBags.length > 0) {
            console.log(`\n📤 Enviando ${collectedBags.length} bolsas para o webhook...`);
            await sendToWebhook(collectedBags);
            console.log('✅ Finalizado!');
        }

    } catch (e) {
        console.error(e.message);
    } finally {
        await browser.close();
    }
}

sendBags();
