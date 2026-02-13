const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const { buildFarmMessage } = require('./messageBuilder');
const { getExistingIdsFromDrive } = require('./driveManager');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-azideias-n8n.ncmzbc.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
const NOVIDADES_URL = 'https://www.farmrio.com.br/novidades';

async function scrapeNovidadesNotInDrive() {
    console.log('🚀 INICIANDO SCRAPER: FARM NOVIDADES (QUE NÃO ESTÃO NO DRIVE)');

    // 1. Get IDs from Drive
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📂 Buscando IDs existentes no Drive: ${folderId}`);
    const driveItems = await getExistingIdsFromDrive(folderId);
    // Extraímos apenas os IDs para comparação rápida
    const driveIds = new Set(driveItems.map(item => item.id));
    console.log(`✅ ${driveIds.size} IDs únicos encontrados no Drive.`);

    const { browser, page } = await initBrowser();

    try {
        console.log(`🌐 Navegando para: ${NOVIDADES_URL}`);
        await page.goto(NOVIDADES_URL, { waitUntil: 'networkidle', timeout: 60000 });

        // 2. Scroll several times as suggested by user
        console.log('📜 Rolando a página para carregar produtos...');
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(2000);
        }

        // 3. Extract product links
        console.log('🔎 Coletando links de produtos...');
        const productUrls = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/p"]'));
            return [...new Set(anchors.map(a => a.href))]
                .filter(href => (href.includes('/p?') || href.includes('/p/') || href.endsWith('/p')) &&
                    !href.includes('account') && !href.includes('cart') && !href.includes('wishlist'));
        });

        console.log(`✅ Encontrados ${productUrls.length} links possíveis.`);

        const productsToSend = [];
        const timerData = await checkFarmTimer();

        for (const url of productUrls) {
            if (productsToSend.length >= 2) break;

            // Extract ID from URL for comparison
            // Pattern: /name-COD1-COD2/p or similar
            const idMatch = url.match(/(\d{6,})-(\d+)\/p/);
            let siteId = null;
            if (idMatch) {
                siteId = `${idMatch[1]}_${idMatch[2]}`;
            } else {
                // Fallback for different patterns
                const fallbackMatch = url.match(/(\d{6,})\/p/);
                if (fallbackMatch) siteId = fallbackMatch[1];
            }

            if (siteId && driveIds.has(siteId)) {
                console.log(`⏭️ Ignorando (${siteId}): Já existe no Drive.`);
                continue;
            }

            console.log(`\n📄 Analisando novo produto: ${url}`);
            const product = await parseProduct(page, url);

            if (product) {
                // Basic check for clothing categories
                const forbidden = ['acessório', 'mala', 'bolsa', 'banho', 'utilitário/casa', 'desconhecido'];
                if (forbidden.includes(product.categoria)) {
                    console.log(`   🚫 Descartado (Categoria): ${product.categoria}`);
                    continue;
                }

                console.log(`   ✅ Selecionado: ${product.nome} (${product.categoria})`);
                productsToSend.push(product);
            }
        }

        if (productsToSend.length === 0) {
            console.error('❌ Nenhuma roupa nova (fora do Drive) encontrada em estoque.');
        } else {
            console.log(`\n📤 Enviando ${productsToSend.length} produtos para o webhook...`);

            for (const product of productsToSend) {
                const caption = buildFarmMessage(product, timerData);
                const payload = {
                    id: product.id,
                    store: 'farm',
                    image: product.imagePath || product.imageUrl,
                    caption: caption,
                    price: product.precoAtual,
                    original_price: product.precoOriginal,
                    sizes: product.tamanhos ? product.tamanhos.join(',') : '',
                    url: product.url,
                    is_manual: true,
                    isNovidade: true
                };

                try {
                    const response = await axios.post(WEBHOOK_URL, payload);
                    console.log(`   ✅ Sucesso (${product.nome}): Status ${response.status}`);
                } catch (err) {
                    console.error(`   ❌ Erro Webhook (${product.nome}): ${err.message}`);
                }
            }
        }

    } catch (error) {
        console.error('❌ Erro crítico:', error.message);
    } finally {
        await browser.close();
        console.log('\n🏁 Processo finalizado.');
    }
}

scrapeNovidadesNotInDrive();
