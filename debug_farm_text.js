const { initBrowser } = require('./browser_setup');

async function debugFarmText() {
    const { browser, page } = await initBrowser();
    try {
        await page.goto('https://www.farmrio.com.br/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const insights = await page.evaluate(() => {
            const results = [];
            // Busca todos os textos com OFF ou %
            const elements = Array.from(document.querySelectorAll('*'));
            elements.forEach(el => {
                const text = (el.innerText || '').trim();
                if (text.includes('OFF') || text.toLowerCase().includes('tic-tac') || text.includes('QUERO')) {
                    if (el.children.length < 5) {
                        results.push({
                            tag: el.tagName,
                            class: el.className,
                            text: text.substring(0, 100)
                        });
                    }
                }
            });
            return results;
        });

        console.log('--- INSIGHTS DE TEXTO ---');
        console.log(JSON.stringify(insights, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debugFarmText();
