const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function debugProductPage() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Depurando página de produto: ${url}`);

    const { browser, page } = await initBrowser();
    const ARTIFACT_DIR = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1';

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);

        const html = await page.content();
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'product_debug.html'), html);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_debug.png'), fullPage: true });

        console.log('✅ HTML e Screenshot salvos.');

        const sizes = await page.evaluate(() => {
            const results = [];
            // Procurar por botões de tamanho ou spans
            const possibleSizes = Array.from(document.querySelectorAll('button, span, div'))
                .filter(el => /^(PP|P|M|G|GG|34|36|38|40|42|44|46|48|U|UN)$/.test(el.innerText.trim()));

            return possibleSizes.map(el => ({
                text: el.innerText.trim(),
                tagName: el.tagName,
                className: el.className,
                isDisabled: el.disabled || el.className.toLowerCase().includes('disabled') || el.className.toLowerCase().includes('soldout')
            }));
        });

        console.log('✅ Tamanhos detectados:', JSON.stringify(sizes, null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

debugProductPage();
