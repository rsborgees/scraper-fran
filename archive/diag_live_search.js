const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log('Navigating to Live...');
    await page.goto('https://www.liveoficial.com.br', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, button, i, span')).map(el => ({
            tag: el.tagName,
            id: el.id,
            class: el.className,
            placeholder: el.placeholder || '',
            text: el.innerText || ''
        })).filter(item =>
            item.placeholder.toLowerCase().includes('buscar') ||
            item.class.toLowerCase().includes('search') ||
            item.text.toLowerCase().includes('buscar')
        );
    });

    console.log('Potential search elements:');
    console.dir(inputs, { depth: null });

    await browser.close();
}

test();
