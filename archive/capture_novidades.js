const { initBrowser } = require('./browser_setup');
const fs = require('fs');
const path = require('path');

async function captureNovidades() {
    const { browser, page } = await initBrowser();
    const ARTIFACT_DIR = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1';

    try {
        console.log('🌐 Navegando para Novidades...');
        await page.goto('https://www.farmrio.com.br/novidades', { waitUntil: 'networkidle', timeout: 60000 });

        console.log('📜 Rolando...');
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(2000);
        }

        const screenshotPath = path.join(ARTIFACT_DIR, 'captured_novidades.png');
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`📸 Screenshot capturado em: ${screenshotPath}`);

        const html = await page.content();
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'captured_novidades.html'), html);
        console.log(`📄 HTML capturado em: ${path.join(ARTIFACT_DIR, 'captured_novidades.html')}`);

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

captureNovidades();
