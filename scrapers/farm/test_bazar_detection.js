const { initBrowser } = require('../../browser_setup');

async function testBazarDetection() {
    console.log('🚀 Testing Bazar Detection (Reverse Eng)...');
    const { browser, page } = await initBrowser();

    // Normal product URL
    const url = 'https://www.farmrio.com.br/vestido-curto-selva-grafica-347072/p?utm_campaign=7B1313';

    try {
        console.log(`Testing URL: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4000);

        const analysis = await page.evaluate(() => {
            const results = [];
            const allEls = document.querySelectorAll('*');

            allEls.forEach(el => {
                // Ignore script/style
                if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return;

                // Check if text matches expected breadcrumb terms
                if (el.children.length === 0 && el.innerText) {
                    const txt = el.innerText.trim();
                    if (txt === 'FARM' || txt === 'Vestidos' || txt === 'Novidades') {
                        let path = el.tagName.toLowerCase();
                        let curr = el.parentElement;
                        let count = 0;
                        while (curr && count < 5) {
                            path = `${curr.tagName.toLowerCase()}.${curr.className} > ` + path;
                            curr = curr.parentElement;
                            count++;
                        }
                        results.push({
                            text: txt,
                            path: path,
                            fullClass: el.className
                        });
                    }
                }
            });
            return results;
        });

        console.log('---------------------------------------------------');
        console.log('Element Analysis (Searching for "FARM" / "Vestidos"):');
        analysis.forEach(res => {
            console.log(`Text: "${res.text}"`);
            console.log(`Path: ${res.path}`);
            console.log('---');
        });
        console.log('---------------------------------------------------');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testBazarDetection();
