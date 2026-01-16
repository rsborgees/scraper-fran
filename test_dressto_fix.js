// Test DressTo parser fixes
const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const url = 'https://www.dressto.com.br/vestido-cropped-estampa-mares-01342814-2384/p';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const data = await page.evaluate(() => {
        // NEW LOGIC (from parser fix)
        const sizeButtons = Array.from(document.querySelectorAll('button[data-sku-id], button.vtex-button[class*="skuSelectorItem"]'));
        console.log('Found buttons:', sizeButtons.length);

        const tamanhos = [];

        sizeButtons.forEach(btn => {
            let sizeText = '';

            if (btn.hasAttribute('data-sku-name')) {
                sizeText = btn.getAttribute('data-sku-name');
            } else if (btn.hasAttribute('value')) {
                sizeText = btn.getAttribute('value');
            } else {
                for (let node of btn.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        sizeText = node.textContent.trim();
                        break;
                    }
                }
            }

            const isUnavailable = btn.className.includes('--unavailable') ||
                btn.className.includes('disabled') ||
                btn.getAttribute('aria-disabled') === 'true' ||
                btn.disabled;

            console.log('Button:', sizeText, 'Unavailable:', isUnavailable);

            if (sizeText && !isUnavailable) {
                tamanhos.push(sizeText.toUpperCase());
            }
        });

        return { tamanhos: [...new Set(tamanhos)] };
    });

    console.log('\n✅ RESULTADO FINAL:', data);
    console.log('Expected: PP, P, M, G, GG (only available sizes)');

    await browser.close();
}

test().catch(console.error);
