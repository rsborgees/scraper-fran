const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false }); // Headless OR Headful
    const page = await browser.newPage();
    const id = '349786'; // ID que falhou

    console.log(`Testing search for ID: ${id}`);
    await page.goto(`https://www.farmrio.com.br/busca?q=${id}`, { waitUntil: 'networkidle' });
    
    console.log('Page loaded. Taking screenshot...');
    await page.screenshot({ path: 'search_debug.png' });
    
    // Check for selectors
    const selector = '.vtex-product-summary-2-x-clearLink, .shelf-product-item a, a[href*="/p"]';
    const count = await page.locator(selector).count();
    console.log(`Found ${count} elements matching selector: ${selector}`);
    
    if (count > 0) {
        const href = await page.locator(selector).first().getAttribute('href');
        console.log(`First link href: ${href}`);
    } else {
        console.log('No products found with current selectors.');
        // Dump HTML
        const fs = require('fs');
        fs.writeFileSync('search_debug.html', await page.content());
        console.log('Saved HTML to search_debug.html');
    }

    await browser.close();
})();
