const { initBrowser } = require('./browser_setup');
const path = require('path');
const fs = require('fs');

async function runDiagnostic() {
    console.log('🔍 [DIAGNOSTIC COMPREHENSIVO V2] Iniciando análise DressTo...');

    const { browser, context, page } = await initBrowser();
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);

    try {
        // 🛡️ ANTI-REDIRECT: Enforce Brazil Region via Cookies
        await context.addCookies([
            {
                name: 'vtex_segment',
                value: 'eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9',
                domain: '.dressto.com.br',
                path: '/'
            }
        ]);

        const targetUrl = 'https://www.dressto.com.br/nossas-novidades?sc=1';
        console.log(`📡 Navegando para: ${targetUrl}`);

        let response = await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        console.log(`📥 Status Inicial: ${response.status()}`);
        let title = await page.title();
        console.log(`📄 Título Inicial: ${title}`);

        // 🔄 TESTANDO RECUPERAÇÃO AUTOMÁTICA
        if (title.includes('Render Server - Error') || response.status() === 500) {
            console.log('⚠️ ERRO DE RENDERIZAÇÃO DETECTADO. Tentando recarregar (Simulando correção)...');
            await page.waitForTimeout(5000);
            response = await page.reload({ waitUntil: 'domcontentloaded' });
            console.log(`📥 Status após Reload: ${response.status()}`);
            title = await page.title();
            console.log(`📄 Título após Reload: ${title}`);
        }

        // Espera extra para JS carregar
        await page.waitForTimeout(10000);

        const finalUrl = page.url();
        console.log(`🔗 URL Final: ${finalUrl}`);

        // Tira print mesmo headless
        const screenshotPath = path.join(debugDir, 'diag_dressto_server_recovery.png');
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
            return results;
        });

        console.log('📊 Diagnóstico de DOM:', JSON.stringify(diagnostics, null, 2));

        if (diagnostics.productLinksCount === 0) {
            console.log('❌ Nenhum link de produto encontrado após recuperação.');
        } else {
            console.log(`✅ Sucesso! Encontrados ${diagnostics.productLinksCount} links de produtos.`);
        }

    } catch (err) {
        console.error('❌ Erro no diagnóstico:', err.message);
    } finally {
        await browser.close();
        console.log('🏁 Fim do diagnóstico.');
    }
}

runDiagnostic();
