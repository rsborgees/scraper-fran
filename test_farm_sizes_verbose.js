const { initBrowser } = require('./browser_setup');

(async () => {
    const url = "https://www.farmrio.com.br/vestido-longo-estampado-flor-de-praia-flor-de-praia_amarelo-jasmim-351062-53944/p";
    const { browser, page } = await initBrowser();

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    const sizes = await page.evaluate(() => {
        const getSafeText = (el) => (el ? (el.innerText || el.textContent || '').trim() : '');
        const sizeSelectors = [
            '.vtex-store-components-3-x-skuSelectorItem',
            'div[class*="skuSelector"]',
            '.size-item',
            'button',
            'label'
        ];

        const potentialSizes = Array.from(document.querySelectorAll(sizeSelectors.join(',')));
        return potentialSizes.map(el => {
            const txt = getSafeText(el);
            const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i);
            if (!match) return null;

            return {
                text: txt,
                tag: el.tagName,
                classes: el.getAttribute('class'),
                parentClasses: el.parentElement ? el.parentElement.getAttribute('class') : null,
                parentText: el.parentElement ? el.parentElement.innerText : null,
                isVisible: el.offsetWidth > 0 || el.offsetHeight > 0
            };
        }).filter(x => x !== null);
    });

    console.log("Found sizes in DOM:");
    sizes.forEach(s => {
        console.log(`- ${s.text} (${s.tag}) | Vis: ${s.isVisible}`);
        console.log(`  Classes: ${s.classes}`);
        console.log(`  Parent Text: ${s.parentText?.replace(/\n/g, ' ')}`);
    });

    await browser.close();
})();
