require('dotenv').config();
const { sendToWebhook } = require('./cronScheduler');
const { chromium } = require('playwright');
const { parseProduct } = require('./scrapers/farm/parser');

async function sendFiveFarmBazarLive() {
    console.log('🚀 Iniciando coleta de 5 peças LIVE da Farm para BAZAR...');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('📡 Navegando para novidades da Farm...');
        await page.goto('https://www.farmrio.com.br/novidades', { waitUntil: 'networkidle', timeout: 60000 });

        // Wait for some product to appear
        console.log('⏳ Aguardando carregamento dos produtos...');
        await page.waitForSelector('a[href*="/p"]', { timeout: 30000 });

        // Scroll a bit to load more if needed
        await page.mouse.wheel(0, 1000);
        await new Promise(r => setTimeout(r, 2000));

        // Get the first 5 product links
        const productLinks = await page.evaluate(() => {
            const regex = /\/p(\?|$)/i;
            const anchors = Array.from(document.querySelectorAll('a[href*="/p"]'));
            return anchors
                .map(l => l.href)
                .filter(href => regex.test(href))
                .slice(0, 8);
        });

        const uniqueLinks = [...new Set(productLinks)];
        console.log(`🔍 Encontrados ${uniqueLinks.length} links de produtos. Iniciando parse...`);

        const results = [];
        for (const link of uniqueLinks) {
            if (results.length >= 5) break;

            console.log(`🔍 Raspando: ${link}`);
            try {
                await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                const product = await parseProduct(page, link);
                if (product && product.precoAtual > 0) {
                    product.bazar = true;
                    product.isBazar = true;
                    product.loja = 'farm';
                    product.brand = 'FARM';
                    results.push(product);
                    console.log(`   ✅ Sucesso: ${product.nome} (R$ ${product.precoAtual})`);
                }
            } catch (err) {
                console.error(`   ❌ Erro no link ${link}:`, err.message);
            }
        }

        if (results.length > 0) {
            console.log(`✅ Coletados ${results.length} itens. Enviando para webhook...`);
            await sendToWebhook(results);
            console.log('🎯 Envio concluído!');
        } else {
            console.log('❌ Nenhum produto coletado com sucesso.');
        }

    } catch (err) {
        console.error('❌ Erro fatal:', err.message);
    } finally {
        await browser.close();
    }
}

sendFiveFarmBazarLive().catch(console.error);
