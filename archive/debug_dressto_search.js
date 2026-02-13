const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const id = '01342750';
    const searchUrl = `https://www.dressto.com.br/${id}?map=ft`;

    console.log('Navegando para:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log('URL final:', url);

    const isProductPage = url.includes('/p');
    console.log('É página de produto?', isProductPage);

    if (!isProductPage) {
        // Verifica se tem produtos na página de resultados
        const hasProducts = await page.evaluate(() => {
            const links = document.querySelectorAll('a.vtex-product-summary-2-x-clearLink, a[href$="/p"]');
            console.log('Links encontrados:', links.length);
            return links.length > 0;
        });

        console.log('Tem produtos na página?', hasProducts);

        // Verifica se é página de "não encontrado"
        const notFound = await page.evaluate(() => {
            const text = document.body.innerText || '';
            return text.includes('Nenhum produto foi encontrado') ||
                text.includes('não encontrado') ||
                text.includes('Ops');
        });

        console.log('Página de não encontrado?', notFound);
    }

    await page.screenshot({ path: 'debug_dressto_search.png' });
    console.log('Screenshot salvo em debug_dressto_search.png');

    await page.waitForTimeout(5000);
    await browser.close();
})();
