// Quick test to check DressTo size parsing issue
const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://www.dressto.com.br/vestido-cropped-estampa-mares-01342814-2384/p', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const data = await page.evaluate(() => {
        const sizeEls = Array.from(document.querySelectorAll('.dresstoshop-commercegrowth-custom-0-x-skuselector__item'));
        console.log('Total size elements found:', sizeEls.length);

        const tamanhos = [];
        sizeEls.forEach((li, idx) => {
            let sizeText = '';
            for (let node of li.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const t = node.textContent.trim();
                    if (t) {
                        sizeText = t;
                        break;
                    }
                }
            }

            if (!sizeText) {
                sizeText = li.innerText.split('\n')[0].trim();
            }

            const isUnavailable = li.className.includes('--unavailable') ||
                li.className.includes('disabled') ||
                li.getAttribute('aria-disabled') === 'true';

            const isValidSize = sizeText && sizeText.length <= 4 && !sizeText.includes('disponível') && !sizeText.includes('olho');

            if (isValidSize && !isUnavailable) {
                tamanhos.push(sizeText.toUpperCase());
            }
        });

        return { tamanhos };
    });

    console.log('\n\nFinal result:', data);

    await browser.close();
}

test();
