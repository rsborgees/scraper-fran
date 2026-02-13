const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function captureFullText() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Capturando texto total em: ${url}`);

    const { browser, page } = await initBrowser();

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        // Scroll lento para garantir que os intersect/lazy carreguem
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 500));
            await page.waitForTimeout(1000);
        }

        await page.waitForTimeout(3000);

        const text = await page.evaluate(() => document.body.innerText);
        fs.writeFileSync('full_pdp_text.txt', text);
        console.log('✅ Texto salvo em full_pdp_text.txt');

        await page.screenshot({ path: 'pdp_full.png', fullPage: true });
        console.log('✅ Screenshot salvo.');

        // Verificar por strings conhecidas
        const hasSizes = /PP|P|M|G|GG/.test(text);
        const hasAdicionar = /adicionar|mochila/i.test(text);

        console.log(`📊 Tem tamanhos no texto? ${hasSizes}`);
        console.log(`📊 Tem 'adicionar' ou 'mochila' no texto? ${hasAdicionar}`);

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

captureFullText();
