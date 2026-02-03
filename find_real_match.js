const { initBrowser } = require('./browser_setup');
const { parseProductZZMall } = require('./scrapers/zzmall');
require('dotenv').config();

(async () => {
    const { browser, page } = await initBrowser();

    const candidates = [
        { id: '1356900110008', driveUrl: 'https://drive.google.com/uc?export=download&id=17xSeTiH1HDA0AmjqMf75fmrdpdfO7pSm' },
        { id: '1364200730002', driveUrl: 'https://drive.google.com/uc?export=download&id=15qCZlYxofA-gv-zpdISfIzWVnk4a4LTK' },
        { id: '1017611210022', driveUrl: 'https://drive.google.com/uc?export=download&id=1LQAYd2Fn7maMzy2BXwzOcwC5kdzpSJ-R' }
    ];

    console.log('🚀 Checking availability of Drive items on ZZMall...');

    for (const item of candidates) {
        // Construct potential search/product URLs
        // ZZMall usually follows /name-of-product/p/ID
        // We can try searching or guessing. Since search is flaky, let's try a direct URL pattern if possible, 
        // or just try to find it via a "generic" p/ID url if ZZMall supports it (many VTEX stores do /p?id=... or similar but ZZMall is /p/SKU)

        // ZZMall URL structure often ends in /p/SKU + params
        // But we need the slug. 
        // Let's try to search by ID in the search bar if possible? 
        // Or simpler: Just log that we are trying to use these.

        // Actually, let's try to fetch a known "Search" url like:
        // https://www.zzmall.com.br/generics/search?ft=ID
        // But that returns JSON or HTML.

        const searchUrl = `https://www.zzmall.com.br/${item.id}`; // redirects or search
        console.log(`\n🔎 Checking: ${item.id}`);

        try {
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(2000);

            const currentUrl = page.url();
            console.log(`   📍 Redirected to: ${currentUrl}`);

            if (currentUrl.includes('/p/')) {
                console.log('   ✅ Product Page Found!');
                const product = await parseProductZZMall(page, currentUrl);
                if (product) {
                    console.log(`   📦 Name: ${product.nome}`);
                    console.log(`   💰 Price: ${product.precoAtual}`);

                    // FOUND A MATCH!
                    console.log('   🎉 MATCH FOUND! Returning details...');
                    console.log(JSON.stringify({ found: true, product, driveInfo: item }));
                    await browser.close();
                    return;
                }
            } else {
                console.log('   ❌ Not a product page.');
            }
        } catch (e) {
            console.log(`   ⚠️ Error checking ${item.id}: ${e.message}`);
        }
    }

    console.log('\n❌ No matched products found.');
    await browser.close();
})();
