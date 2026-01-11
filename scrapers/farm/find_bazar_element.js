const { initBrowser } = require('../../browser_setup');

async function findBazarElement() {
    console.log('🚀 Finding "Bazar" elements in DOM...');
    const { browser, page } = await initBrowser();

    // Bazar URL
    const url = 'https://www.farmrio.com.br/top-estampado-coqueiral-coqueiral_galao_preto-357793-51202/p?brand=farm';

    try {
        console.log(`Testing URL: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const results = await page.evaluate(() => {
            const matches = [];

            // Walker to find text nodes
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                const txt = node.nodeValue.trim();
                if (txt.toLowerCase().includes('bazar')) {
                    const parent = node.parentElement;
                    if (!parent) continue;

                    // Filter out header/footer/script
                    const closestTag = parent.tagName.toLowerCase();
                    if (['script', 'style', 'noscript', 'meta'].includes(closestTag)) continue;

                    // Build path
                    let path = closestTag;
                    let curr = parent.parentElement;
                    let count = 0;
                    while (curr && count < 6) {
                        path = `${curr.tagName.toLowerCase()}.${curr.className} > ` + path;
                        if (curr.tagName.toLowerCase() === 'footer') {
                            path = 'FOOTER > ' + path;
                            break;
                        }
                        if (curr.tagName.toLowerCase() === 'header') {
                            path = 'HEADER > ' + path;
                            break;
                        }
                        curr = curr.parentElement;
                        count++;
                    }

                    matches.push({
                        text: txt,
                        path: path,
                        fullClass: parent.className
                    });
                }
            }
            return matches;
        });

        console.log('---------------------------------------------------');
        console.log('Text Node Analysis for "Bazar":');
        results.forEach(m => {
            console.log(`Text: "${m.text}"`);
            console.log(`Path: ${m.path}`);
            console.log('---');
        });
        console.log('---------------------------------------------------');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

findBazarElement();
