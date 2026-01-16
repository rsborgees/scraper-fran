// Quick test to check DressTo size parsing issue
const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://www.dressto.com.br/vestido-cropped-estampa-mares-01342814-2384/p', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const data = await page.evaluate(() => {
        const sizeEls = Array.from(document.querySelectorAll('[class*="skuselector__item"]'));
        console.log('Total size elements found:', sizeEls.length);

        const tamanhos = [];
        sizeEls.forEach((el, idx) => {
            console.log(`\n--- Element ${idx} ---`);
            console.log('innerHTML:', el.innerHTML);
            console.log('textContent:', el.textContent);
            console.log('childNodes[0]:', el.childNodes[0] ? el.childNodes[0].textContent : 'N/A');
            console.log('className:', el.className);

            const txt = el.childNodes[0] ? el.childNodes[0].textContent.trim() : '';
            const isUnavailable = el.className.includes('--unavailable') ||
                el.className.includes('disabled') ||
                el.getAttribute('aria-disabled') === 'true';

            if (txt && !isUnavailable) {
                tamanhos.push(txt.toUpperCase());
            }
        });

        return { tamanhos };
    });

    console.log('\n\nFinal result:', data);

    await browser.close();
}

test();
