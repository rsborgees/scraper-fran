
const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function debugPrice() {
    const url = 'https://www.farmrio.com.br/maio-artesanal-cutwork-bananeira-cafe-362597-1592/p?brand=farm';
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

        const html = await page.content();
        fs.writeFileSync('debug_farm_price.html', html);
        console.log('HTML saved to debug_farm_price.html');

        const prices = await page.evaluate(() => {
            const results = [];
            // Procura por todos os preços r$ na página
            const elements = Array.from(document.querySelectorAll('*'));
            elements.forEach(el => {
                if (el.children.length === 0 && el.innerText.includes('R$')) {
                    results.push({
                        tag: el.tagName,
                        class: el.className,
                        text: el.innerText
                    });
                }
            });
            return results;
        });

        console.log('Detected Prices in DOM:');
        console.log(JSON.stringify(prices, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

debugPrice();
