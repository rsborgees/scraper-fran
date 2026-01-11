const { chromium } = require('playwright');

async function debugPrice() {
    console.log('--- DEBUGGING LIVE PRICE ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const url = 'https://www.liveoficial.com.br/parka-long-nylon-volt-wax-I408400AM62/p';

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000);

        const data = await page.evaluate(() => {
            const data = {};

            // Meta tags
            const metaPrice = document.querySelector('meta[property="product:price:amount"]');
            data.metaPriceAmount = metaPrice ? metaPrice.content : 'null';

            const metaPrice2 = document.querySelector('meta[itemprop="price"]');
            data.metaItemProp = metaPrice2 ? metaPrice2.content : 'null';

            // Selectors
            const selectors = [
                '.vtex-product-price-1-x-sellingPriceValue',
                '.vtex-product-price-1-x-bestPriceValue',
                '.skuBestPrice',
                '.product-price__value',
                '.vtex-store-components-3-x-sellingPrice',
                '.vtex-store-components-3-x-listPrice'
            ];

            data.selectors = {};
            selectors.forEach(sel => {
                const el = document.querySelector(sel);
                data.selectors[sel] = el ? el.innerText : 'not found';
            });

            // Find path to 489,90
            const target = Array.from(document.querySelectorAll('*'))
                .find(el => el.children.length === 0 && (el.innerText || '').includes('489,90'));

            if (target) {
                let path = [];
                let curr = target;
                while (curr && curr.tagName !== 'BODY') {
                    path.unshift(`${curr.tagName.toLowerCase()}.${curr.className.replace(/ /g, '.')}`);
                    curr = curr.parentElement;
                }
                data.targetPath = path.join(' > ');
                data.targetAttributes = target.getAttributeNames().map(n => `${n}=${target.getAttribute(n)}`);
            } else {
                data.targetPath = "Not Found";
            }

            // All R$ elements
            data.allPrices = Array.from(document.querySelectorAll('*'))
                .filter(el => el.children.length === 0 && (el.innerText || '').includes('R$'))
                .map(el => ({ tag: el.tagName, text: el.innerText, class: el.className }));

            // Find common ancestor of H1 and 489,90
            const h1 = document.querySelector('h1');
            const priceEl = Array.from(document.querySelectorAll('div')).find(el => (el.innerText || '').includes('489,90'));

            let commonAncestor = 'Not found';
            if (h1 && priceEl) {
                const parentsH1 = [];
                let curr = h1;
                while (curr) { parentsH1.push(curr); curr = curr.parentElement; }

                curr = priceEl;
                while (curr) {
                    if (parentsH1.includes(curr)) {
                        commonAncestor = `${curr.tagName.toLowerCase()}.${curr.className.replace(/ /g, '.')}`;
                        break;
                    }
                    curr = curr.parentElement;
                }
            }
            data.commonAncestor = commonAncestor;

            return data;
        });

        console.log(JSON.stringify(data, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

debugPrice();
