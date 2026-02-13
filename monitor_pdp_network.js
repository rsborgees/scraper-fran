const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function monitorPdpNetwork() {
    const url = 'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm';
    console.log(`🔍 Monitorando rede em: ${url}`);

    const { browser, page } = await initBrowser();
    const requests = [];

    page.on('request', request => {
        const reqUrl = request.url();
        if (reqUrl.includes('api') || reqUrl.includes('deco/render')) {
            requests.push({
                url: reqUrl,
                method: request.method(),
                resourceType: request.resourceType()
            });
        }
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 500));
            await page.waitForTimeout(1000);
        }

        await page.waitForTimeout(5000);

        fs.writeFileSync('pdp_network_requests.json', JSON.stringify(requests, null, 2));
        console.log(`✅ ${requests.length} requisições registradas.`);

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

monitorPdpNetwork();
