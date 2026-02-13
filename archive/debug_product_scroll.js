const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function debugProductPageScroll() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Depurando página de produto com SCROLL: ${url}`);

    const { browser, page } = await initBrowser();
    const ARTIFACT_DIR = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1';

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        console.log('📜 Rolando para carregar fragmentos...');
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(5000);

        const html = await page.content();
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'product_scroll_debug.html'), html);

        const sizes = await page.evaluate(() => {
            // Procurar em labels, buttons ou spans que tenham PP, P, M, G, GG etc
            const elts = Array.from(document.querySelectorAll('label, button, span, div'))
                .filter(el => /^(PP|P|M|G|GG|34|36|38|40|42|44|46|48|U|UN)$/.test(el.innerText.trim()));

            return elts.map(el => ({
                text: el.innerText.trim(),
                parentClass: el.parentElement?.className,
                className: el.className,
                isDisabled: el.disabled || el.className.includes('disabled') || el.parentElement?.className.includes('disabled')
            }));
        });

        console.log('✅ Tamanhos detectados após scroll:', JSON.stringify(sizes, null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

debugProductPageScroll();
