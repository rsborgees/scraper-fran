const { initBrowser } = require('./browser_setup');

async function debugBanners() {
    const { browser, page } = await initBrowser();

    try {
        console.log('🔍 INICIANDO VARREDURA PROFUNDA DE BANNERS DA FARM...\n');

        const scanPage = async (pageLabel) => {
            return await page.evaluate((label) => {
                const results = {
                    texts: [],
                    images: [],
                    h1: ''
                };

                // 1. Visible Text with keywords
                const allEls = document.querySelectorAll('h1, h2, h3, p, span, div[class*="banner"]');
                allEls.forEach(el => {
                    if (el.offsetParent === null) return; // Hidden
                    const txt = el.innerText.replace(/\n/g, ' ').trim();
                    if (txt.length > 5 && txt.length < 150) {
                        if (/(off|%|desconto|bazar|progressiva|verão|alto verão|liqui)/i.test(txt)) {
                            if (!/trocar|devolvida|pedidos|ajuda|login/.test(txt.toLowerCase())) {
                                results.texts.push(txt);
                            }
                        }
                    }
                });

                // 2. Image ALTs (Crucial for Farm which uses image banners)
                const imgs = document.querySelectorAll('img');
                imgs.forEach(img => {
                    if (img.width > 200 && img.height > 50) { // Banner-like size
                        const alt = img.alt || img.title || '';
                        if (alt && /(off|%|desconto|bazar|progressiva)/i.test(alt)) {
                            results.images.push(alt);
                        }
                        // Also grab src if it might contain cues, but alt is better
                    }
                });

                // 3. Main H1
                const h1 = document.querySelector('h1');
                if (h1) results.h1 = h1.innerText;

                return results;
            }, pageLabel);
        };

        // 1. HOME PAGE
        const mainUrl = 'https://www.farmrio.com.br/?utm_campaign=7B1313';
        console.log(`➡️  Acessando HOME: ${mainUrl}`);
        await page.goto(mainUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(6000); // 6s for sliders

        const mainData = await scanPage('HOME');
        console.log('\n--- HOME ANALYSIS ---');
        console.log('H1:', mainData.h1);
        console.log('Promo Texts:', [...new Set(mainData.texts)].slice(0, 5));
        console.log('Banner Images:', [...new Set(mainData.images)].slice(0, 5));

        // 2. BAZAR PAGE
        const bazarUrl = 'https://www.farmrio.com.br/bazar?utm_campaign=7B1313';
        console.log(`\n➡️  Acessando BAZAR: ${bazarUrl}`);
        await page.goto(bazarUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(6000);

        const bazarData = await scanPage('BAZAR');
        console.log('\n--- BAZAR ANALYSIS ---');
        console.log('H1:', bazarData.h1);
        console.log('Promo Texts:', [...new Set(bazarData.texts)].slice(0, 5));
        console.log('Banner Images:', [...new Set(bazarData.images)].slice(0, 5));

    } catch (error) {
        console.error('❌ Erro na extração:', error);
    } finally {
        await browser.close();
    }
}

debugBanners();
