const { initBrowser } = require('./browser_setup');

const urls = [
    'https://www.kjubrasil.com/necessaire-amo-comida-de-praia-farm-etc-inverno-2026/?ref=7B1313',
    'https://www.kjubrasil.com/necessaire-cacula-xadrez-multicolorido-farm-etc-inverno-2026/?ref=7B1313',
    'https://www.kjubrasil.com/necessaire-cacula-passarejo-multicolor-off-white-farm-etc-inverno-2026/?ref=7B1313'
];

async function debugKjuValues() {
    console.log('🚀 Starting KJU Value Debug...');
    const { browser, page } = await initBrowser();

    try {
        for (const url of urls) {
            console.log(`\n-----------------------------------`);
            console.log(`Testing URL: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 4000)); // Wait for lazy load/JS rendering

            const analysis = await page.evaluate(() => {
                const getSafeText = (el) => {
                    if (!el) return '';
                    const txt = el.innerText || el.textContent || '';
                    return (typeof txt === 'string') ? txt.trim().replace(/\s+/g, ' ') : '';
                };

                // 1. Capture ALL visible text containing "R$"
                const allPriceTexts = [];
                document.querySelectorAll('*').forEach(el => {
                    if (el.children.length === 0 && el.textContent.includes('R$')) {
                        allPriceTexts.push({
                            tag: el.tagName,
                            class: el.className,
                            text: getSafeText(el),
                            parentClass: el.parentElement ? el.parentElement.className : '',
                            grandParentClass: el.parentElement && el.parentElement.parentElement ? el.parentElement.parentElement.className : ''
                        });
                    }
                });

                // 2. Capture specific price container HTML
                let container = document.querySelector('.produto-info') || document.querySelector('.info') || document.querySelector('#product-container') || document.body;

                // 3. Try to Identify specific price elements using current logic selectors
                const oldPriceEl = container.querySelector('.old-price, .price-old, .preco-de, .valor_de, del, s, .strikethrough');
                const priceElements = Array.from(container.querySelectorAll('.price, .current-price, .preco-por, .preco-venda, .special-price, span, div, strong, b'));

                const currentLogicMatches = priceElements.map(el => {
                    const txt = getSafeText(el);
                    if (!txt.includes('R$')) return null;
                    return { text: txt, class: el.className };
                }).filter(Boolean);


                return {
                    title: document.title,
                    allPriceTexts: allPriceTexts,
                    containerHTML: container ? container.innerHTML.substring(0, 3000) : 'No Container', // Truncate
                    currentLogic: {
                        oldPriceFound: oldPriceEl ? getSafeText(oldPriceEl) : 'None',
                        currentPriceCandidates: currentLogicMatches
                    }
                };
            });

            console.log('Page Title:', analysis.title);
            console.log('--- ALL "R$" TEXTS FOUND ---');
            console.log(JSON.stringify(analysis.allPriceTexts, null, 2));
            console.log('--- CURRENT LOGIC MATCHES ---');
            console.log(JSON.stringify(analysis.currentLogic, null, 2));

        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

debugKjuValues();
