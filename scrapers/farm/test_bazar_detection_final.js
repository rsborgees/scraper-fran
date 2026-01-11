const { initBrowser } = require('../../browser_setup');

async function testBazarDetectionFinal() {
    console.log('🚀 Testing Bazar Detection (Final Selector Check)...');
    const { browser, page } = await initBrowser();

    const urls = [
        { type: 'BAZAR', url: 'https://www.farmrio.com.br/top-estampado-coqueiral-coqueiral_galao_preto-357793-51202/p?brand=farm' },
        { type: 'NORMAL', url: 'https://www.farmrio.com.br/vestido-curto-selva-grafica-347072/p?utm_campaign=7B1313' }
    ];

    try {
        for (const item of urls) {
            console.log(`\n🔎 Testing ${item.type}: ${item.url}`);
            await page.goto(item.url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);

            const result = await page.evaluate(() => {
                // Target the specific container identified found in diagnostics
                // "div.font-galano text-xs font-light lowercase > ul"
                const crumbContainer = document.querySelector('div.font-galano ul, ul.flex.items-center.gap-2');

                if (crumbContainer) {
                    return {
                        found: true,
                        text: crumbContainer.innerText.replace(/\n/g, ' > '),
                        html: crumbContainer.innerHTML.substring(0, 100)
                    };
                }

                // Fallback: search for "farm" link in main content
                const mainLinks = Array.from(document.querySelectorAll('main a, section a'));
                const farmLink = mainLinks.find(a => a.innerText.toLowerCase().trim() === 'farm');
                if (farmLink) {
                    return { found: true, text: 'Fallback: ' + farmLink.parentElement.innerText, type: 'fallback' };
                }

                return { found: false };
            });

            console.log(`   [${item.type}] Breadcrumb Found: ${result.found}`);
            if (result.found) console.log(`   [${item.type}] Text: "${result.text}"`);

            const isBazar = result.found && result.text.toLowerCase().includes('bazar');
            console.log(`   👉 IS BAZAR? ${isBazar}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testBazarDetectionFinal();
