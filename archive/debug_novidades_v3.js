const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function debugNovidadesStructure() {
    console.log('🔍 Diagnosticando estrutura da aba Novidades...');
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.farmrio.com.br/novidades', { waitUntil: 'networkidle', timeout: 60000 });

        console.log('📜 Rolando...');
        for (let i = 0; i < 2; i++) {
            await page.evaluate(() => window.scrollBy(0, 800));
            await page.waitForTimeout(2000);
        }

        // Vamos procurar por elementos que tenham "R$" (preços) e ver o que está em volta
        const results = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const priceElements = elements.filter(el => {
                const text = el.innerText || '';
                return text.includes('R$') && el.children.length === 0;
            });

            return priceElements.slice(0, 5).map(el => {
                let parent = el.parentElement;
                let path = [el.tagName];
                for (let i = 0; i < 5 && parent; i++) {
                    path.unshift(`${parent.tagName}.${(parent.className || '').split(' ').join('.')}`);
                    parent = parent.parentElement;
                }
                return {
                    text: el.innerText,
                    path: path.join(' > ')
                };
            });
        });

        console.log('✅ Amostra de elementos com preço:', JSON.stringify(results, null, 2));

        // Vamos procurar por qualquer link que tenha um ID de produto (6 dígitos)
        const possibleLinks = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors
                .map(a => ({ href: a.href, text: a.innerText, className: a.className }))
                .filter(a => /\d{6,}/.test(a.href) || /\d{6,}/.test(a.text));
        });

        console.log('✅ Links que parecem ser de produtos:', JSON.stringify(possibleLinks.slice(0, 10), null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

debugNovidadesStructure();
