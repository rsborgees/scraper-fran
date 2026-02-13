const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function debugNovidades() {
    console.log('🔍 Debugging Novidades Page...');
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.farmrio.com.br/novidades', { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('✅ Page loaded.');

        // Wait for potential dynamic content
        await page.waitForTimeout(5000);

        // Take a screenshot
        await page.screenshot({ path: 'debug_novidades_grid.png' });
        console.log('📸 Screenshot saved to debug_novidades_grid.png');

        // Get some info about <a> tags
        const linkInfo = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const withP = anchors.filter(a => a.href.includes('/p/') || a.href.includes('/p?'));
            const withCard = anchors.filter(a => a.classList.contains('card'));

            return {
                totalAnchors: anchors.length,
                hrefsWithP: withP.map(a => a.href).slice(0, 10),
                countWithP: withP.length,
                countWithCard: withCard.length
            };
        });

        console.log('📊 Result:', JSON.stringify(linkInfo, null, 2));

        // Save HTML for deep inspection
        const html = await page.content();
        fs.writeFileSync('debug_novidades.html', html);
        console.log('📄 HTML saved to debug_novidades.html');

    } catch (err) {
        console.error('❌ Error during debug:', err);
    } finally {
        await browser.close();
    }
}

debugNovidades();
