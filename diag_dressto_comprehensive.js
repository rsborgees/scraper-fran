const { initBrowser } = require('./browser_setup');
const path = require('path');
const fs = require('fs');

async function runDiagnostic() {
    console.log('🔍 [DIAGNOSTIC COMPREHENSIVO] Iniciando análise DressTo...');

    const { browser, context, page } = await initBrowser();
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);

    try {
        const targetUrl = 'https://www.dressto.com.br/nossas-novidades';
        console.log(`📡 Navegando para: ${targetUrl}`);

        const response = await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        console.log(`📥 Status HTTP: ${response.status()}`);

        // Espera extra para JS carregar
        await page.waitForTimeout(10000);

        const finalUrl = page.url();
        const title = await page.title();
        console.log(`🔗 URL Final: ${finalUrl}`);
        console.log(`📄 Título: ${title}`);

        if (finalUrl.includes('dressto.com/') && !finalUrl.includes('.com.br')) {
            console.log('⚠️ REDIRECIONAMENTO INTERNACIONAL DETECTADO!');
        }

        // Tira print mesmo headless
        const screenshotPath = path.join(debugDir, 'diag_dressto_server_view.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot salvo em: ${screenshotPath}`);

        // Verifica seletores
        const diagnostics = await page.evaluate(() => {
            const results = {};
            results.hasClearLink = !!document.querySelector('a.vtex-product-summary-2-x-clearLink');
            results.hasProductSummary = !!document.querySelector('.vtex-product-summary-2-x-container');
            results.allLinksCount = document.querySelectorAll('a').length;
            results.productLinksCount = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/p')).length;
            results.bodySnippet = document.body.innerText.substring(0, 500);
            results.htmlLang = document.documentElement.lang;
            return results;
        });

        console.log('📊 Diagnóstico de DOM:', JSON.stringify(diagnostics, null, 2));

        if (diagnostics.productLinksCount === 0) {
            console.log('❌ Nenhum link de produto encontrado.');
        } else {
            console.log(`✅ Encontrados ${diagnostics.productLinksCount} links que parecem ser de produtos.`);
        }

    } catch (err) {
        console.error('❌ Erro no diagnóstico:', err.message);
    } finally {
        await browser.close();
        console.log('🏁 Fim do diagnóstico.');
    }
}

runDiagnostic();
