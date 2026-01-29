const { initBrowser } = require('./browser_setup');
const path = require('path');
const fs = require('fs');

async function runDiagnostic() {
    const testId = '01332303'; // ID de exemplo do log de erro do usuário
    console.log(`🔍 [DIAGNOSTIC SEARCH V4] Testando busca do ID: ${testId}...`);

    const { browser, context, page } = await initBrowser();
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);

    try {
        await context.addCookies([
            {
                name: 'vtex_segment',
                value: 'eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9',
                domain: '.dressto.com.br',
                path: '/'
            }
        ]);

        const directUrl = `https://www.dressto.com.br/${testId}?_q=${testId}&map=ft&sc=1`;
        console.log(`📡 Navegando para URL direta: ${directUrl}`);

        const response = await page.goto(directUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        console.log(`📥 Status: ${response.status()}`);
        console.log(`📄 Título: ${await page.title()}`);

        const screenshotPath = path.join(debugDir, `diag_search_${testId}.png`);
        await page.screenshot({ path: screenshotPath });

        // 🕵️ ESTRATÉGIA DE EXTRAÇÃO DE EMERGÊNCIA (VTEX __STATE__)
        // Muitas vezes o VTEX retorna 500 mas o HTML ainda contém o objeto de estado com os dados do produto
        console.log('🕵️ Verificando se existe objeto __STATE__ no HTML...');
        const vtexStateHtml = await page.content();
        const hasState = vtexStateHtml.includes('__STATE__');
        console.log(`📊 Objeto __STATE__ encontrado: ${hasState}`);

        if (hasState) {
            const productData = await page.evaluate(() => {
                try {
                    // Tenta extrair dados do objeto global do VTEX
                    const state = window.__STATE__;
                    if (!state) return null;

                    // Procura por chaves que pareçam ser de produtos (ex: "Product:123")
                    const productKey = Object.keys(state).find(k => k.startsWith('Product:'));
                    if (productKey) {
                        return {
                            found: true,
                            key: productKey,
                            name: state[productKey].productName,
                            brand: state[productKey].brand
                        };
                    }
                } catch (e) {
                    return { error: e.message };
                }
                return null;
            });
            console.log('📦 Dados extraídos via __STATE__:', JSON.stringify(productData, null, 2));
        }

        // Testando se a URL de busca padrão (sem slug do ID) funciona melhor
        const searchUrl = `https://www.dressto.com.br/busca?q=${testId}&sc=1`;
        console.log(`\n📡 Testando URL de busca secundária: ${searchUrl}`);
        const responseSearch = await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log(`📥 Status Busca: ${responseSearch.status()}`);
        console.log(`📄 Título Busca: ${await page.title()}`);

    } catch (err) {
        console.error('❌ Erro no diagnóstico V4:', err.message);
    } finally {
        await browser.close();
        console.log('🏁 Fim do diagnóstico.');
    }
}

runDiagnostic();
