const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function debugVestidosPage() {
    console.log('🔍 Debugging Vestidos Page...');
    const { browser, page } = await initBrowser();

    try {
        const url = 'https://www.farmrio.com.br/vestidos';
        console.log(`\n🔍 Navigating to: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);

        const screenshotPath = path.join(__dirname, 'debug', 'debug_vestidos_grid.png');
        if (!fs.existsSync(path.dirname(screenshotPath))) fs.mkdirSync(path.dirname(screenshotPath));
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`📸 Screenshot saved: ${screenshotPath}`);

        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'debug', 'debug_vestidos.html'), html);
        console.log(`📄 HTML saved: debug/debug_vestidos.html`);

        const linkCount = await page.evaluate(() => document.querySelectorAll('a').length);
        console.log(`✅ Total <a> tags: ${linkCount}`);

        const sampleHref = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.slice(0, 10).map(a => a.href);
        });
        console.log('✅ Sample hrefs:', sampleHref);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await browser.close();
    }
}

debugVestidosPage();
