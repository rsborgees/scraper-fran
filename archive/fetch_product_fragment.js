const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function fetchProductFragment() {
    console.log('🌐 Buscando fragmento HTMX de Produto...');
    const { browser, page } = await initBrowser();
    const ARTIFACT_DIR = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1';

    // URL capturada do HTML (primeiro fragmento de lazy rendering)
    const fragmentUrl = 'https://www.farmrio.com.br/deco/render?props={"loading":"eager"}&href=https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm&pathTemplate=/:slug/p&renderSalt=0&__cb=2074971226&resolveChain=[2,"website/handlers/fresh.ts",0,"page",2,"resolved",1,"pages-productpage-ce4850591828",2,"website/pages/Page.tsx",0,"sections",2,"website/flags/multivariate.ts",0,"variants",0,"1",0,"value",2,"resolved",0,"1"]';

    try {
        console.log(`🔍 Navegando para o fragmento: ${fragmentUrl}`);
        await page.goto(fragmentUrl, { waitUntil: 'networkidle', timeout: 60000 });

        await page.waitForTimeout(5000);

        const html = await page.content();
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'product_fragment_1.html'), html);
        console.log(`📄 Fragmento salvo.`);

        const info = await page.evaluate(() => {
            const labels = [];
            // Procurar por botões de tamanho ou spans
            const possibleSizes = Array.from(document.querySelectorAll('button, span, label, div'))
                .filter(el => /^(PP|P|M|G|GG|34|36|38|40|42|44|46|48|U|UN)$/.test(el.innerText.trim()) && el.children.length === 0);

            return possibleSizes.map(el => ({
                text: el.innerText.trim(),
                tag: el.tagName,
                className: el.className,
                parentId: el.parentElement?.id,
                parentClass: el.parentElement?.className
            }));
        });

        console.log('✅ Tamanhos detectados no fragmento:', JSON.stringify(info, null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

fetchProductFragment();
