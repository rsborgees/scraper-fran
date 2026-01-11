const { initBrowser } = require('../../browser_setup');

async function testBazarDetectionJson() {
    console.log('🚀 Testing Bazar Detection (JSON-LD)...');
    const { browser, page } = await initBrowser();

    // Bazar URL
    const url = 'https://www.farmrio.com.br/top-estampado-coqueiral-coqueiral_galao_preto-357793-51202/p?brand=farm';

    try {
        console.log(`Testing URL: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4000);

        const data = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            const jsonObjects = scripts.map(s => {
                try { return JSON.parse(s.innerText); } catch (e) { return null; }
            }).filter(Boolean);

            // Look for BreadcrumbList
            const breadcrumbJson = jsonObjects.find(j => j['@type'] === 'BreadcrumbList');
            let breadcrumbText = '';

            if (breadcrumbJson && breadcrumbJson.itemListElement) {
                // itemListElement can be array of { item: { name: ... } }
                breadcrumbText = breadcrumbJson.itemListElement
                    .map(item => item.name || (item.item ? item.item.name : ''))
                    .join(' > ');
            }

            return {
                jsonCount: jsonObjects.length,
                breadcrumbText: breadcrumbText,
                fullJson: jsonObjects.slice(0, 3) // Dump first 3 for debugging
            };
        });

        console.log('---------------------------------------------------');
        console.log('JSON-LD Analysis:');
        console.log(`Scripts found: ${data.jsonCount}`);
        console.log(`Breadcrumb Path: "${data.breadcrumbText}"`);
        console.log('---------------------------------------------------');

        if (data.breadcrumbText.toLowerCase().includes('bazar')) {
            console.log('✅ "Bazar" DETECTED via JSON-LD!');
        } else {
            console.log('⚠️ "Bazar" NOT detected in JSON-LD.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testBazarDetectionJson();
