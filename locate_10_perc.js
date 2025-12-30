const { initBrowser } = require('./browser_setup');

async function locate10Perc() {
    const { browser, page } = await initBrowser();
    try {
        await page.goto('https://www.farmrio.com.br/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const locs = await page.evaluate(() => {
            const matches = [];
            const all = document.querySelectorAll('*');
            for (const el of all) {
                if (el.innerText && el.innerText.includes('10%')) {
                    if (el.children.length === 0) {
                        matches.push({
                            tag: el.tagName,
                            class: el.className,
                            html: el.outerHTML,
                            parent: el.parentElement.tagName + ' ' + el.parentElement.className
                        });
                    }
                }
            }
            return matches;
        });

        console.log(JSON.stringify(locs, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

locate10Perc();
