
const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function dumpHtml() {
    const url = 'https://www.farmrio.com.br/maio-artesanal-cutwork-bananeira-cafe-362597-1592/p?brand=farm';
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Espera um pouco mais para garantir renderização Deco.cx
        await page.waitForTimeout(5000);

        const html = await page.content();
        fs.writeFileSync('farm_pdp_debug.html', html);
        console.log('HTML saved to farm_pdp_debug.html');

        const priceInfo = await page.evaluate(() => {
            const findText = (query) => {
                const results = [];
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent.includes('598') || node.textContent.includes('478')) {
                        results.push({
                            text: node.textContent.trim(),
                            parentTag: node.parentElement.tagName,
                            parentClass: node.parentElement.className,
                            grandParentClass: node.parentElement.parentElement?.className
                        });
                    }
                }
                return results;
            };
            return findText('598');
        });

        console.log('Price Elements Found:', JSON.stringify(priceInfo, null, 2));

        await page.screenshot({ path: 'farm_pdp_debug.png', fullPage: false });
        console.log('Screenshot saved to farm_pdp_debug.png');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

dumpHtml();
