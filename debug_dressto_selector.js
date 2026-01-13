const { chromium } = require('playwright');
const fs = require('fs');

async function debug() {
    console.log('🕵️ Iniciando debug Dress To...');
    const browser = await chromium.launch({ headless: false }); // Headless false para ver
    const page = await browser.newPage();

    try {
        // 1. Check Search
        console.log('\n--- Testando Busca ---');
        await page.goto('https://www.dressto.com.br', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);

        // Screenshot
        await page.screenshot({ path: 'debug_dressto_home.png' });

        // Check selectors
        const searchInput = await page.$('#downshift-0-input');
        const searchBtn = await page.$('button[title="Buscar"]');
        const searchIcon = await page.$('[class*="SearchCustom_icon"]');

        console.log('Input #downshift-0-input:', !!searchInput);
        console.log('Button title="Buscar":', !!searchBtn);
        console.log('Icon class*="SearchCustom_icon":', !!searchIcon);

        // Try to find ANY input that looks like search
        const inputs = await page.$$eval('input', els => els.map(e => ({
            id: e.id,
            placeholder: e.placeholder,
            class: e.className,
            visible: e.offsetParent !== null
        })));
        console.log('Inputs visíveis:', inputs.filter(i => i.visible && (i.placeholder.includes('busca') || i.id.includes('search'))));


        // 2. Check Product List
        console.log('\n--- Testando Listagem ---');
        await page.goto('https://www.dressto.com.br/nossas-novidades', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000); // Wait for potential heavy load

        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(1000);

        const currentSelector = 'a.vtex-product-summary-2-x-clearLink, a[href$="/p"], a[href*="/p?"]';
        const productsParams = await page.$$eval(currentSelector, els => els.length);
        console.log(`Produtos encontrados com seletor atual (${currentSelector}): ${productsParams}`);

        if (productsParams === 0) {
            console.log('⚠️ Nenhum produto encontrado. Buscando alternativas...');
            // Dump classes of 'a' tags that contain images
            const links = await page.$$eval('a', els => els.map(e => ({
                href: e.href,
                class: e.className,
                hasImg: !!e.querySelector('img'),
                text: e.innerText.slice(0, 30)
            })).filter(e => e.hasImg && e.href.includes('/p')));

            console.log('Links candidatos encontrados (com img e /p):');
            links.slice(0, 5).forEach(l => console.log(l));
        }

    } catch (e) {
        console.error('Erro no debug:', e);
    } finally {
        await browser.close();
    }
}

debug();
