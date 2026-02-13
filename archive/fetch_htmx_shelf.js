const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function fetchHtmxShelf() {
    console.log('🌐 Buscando fragmento HTMX da Vitrine...');
    const { browser, page } = await initBrowser();
    const ARTIFACT_DIR = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1';

    // URL capturada do HTML (substituindo &amp; por &)
    const shelfUrl = 'https://www.farmrio.com.br/deco/render?props={"loading":"eager"}&href=https://www.farmrio.com.br/novidades&pathTemplate=/novidades&renderSalt=0&__cb=2115961422&resolveChain=[2,"website/handlers/fresh.ts",0,"page",2,"resolved",1,"pages-novidades-579134",2,"website/pages/Page.tsx",0,"sections",0,"3"]';

    try {
        console.log(`🔍 Navegando para o fragmento: ${shelfUrl}`);
        await page.goto(shelfUrl, { waitUntil: 'networkidle', timeout: 60000 });

        await page.waitForTimeout(5000);

        const html = await page.content();
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'shelf_fragment.html'), html);
        console.log(`📄 Fragmento salvo em: shelf_fragment.html`);

        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(a => a.href).filter(h => h.includes('/p') || /\d{6,}/.test(h));
        });

        console.log(`✅ Links encontrados no fragmento: ${links.length}`);
        console.log('✅ Amostra:', JSON.stringify(links.slice(0, 10), null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

fetchHtmxShelf();
