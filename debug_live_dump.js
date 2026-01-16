const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function dump() {
    console.log('🚀 Dumping Live DOM...');
    const { browser } = await initBrowser();
    const page = await browser.newPage();

    try {
        await page.goto('https://www.liveoficial.com.br', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000); // Wait for hydration

        const content = await page.content();
        const outPath = path.join(__dirname, 'debug', 'live_body.html');
        if (!fs.existsSync(path.dirname(outPath))) fs.mkdirSync(path.dirname(outPath), { recursive: true });

        fs.writeFileSync(outPath, content);
        console.log(`✅ DOM dumped to ${outPath} (${content.length} bytes)`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

dump();
