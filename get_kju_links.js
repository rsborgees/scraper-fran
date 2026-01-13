const { initBrowser } = require('./browser_setup');

async function getKjuLinks() {
    process.env.HEADLESS = 'true';
    const { browser, page } = await initBrowser();

    try {
        const url = 'https://www.kjubrasil.com/?ref=7B1313';
        console.log(`🔗 Navegando para Home: ${url}`);

        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(5000);

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]')).map(a => ({
                text: a.innerText.trim(),
                href: a.href
            }));
        });

        console.log('🔗 Links encontrados:');
        links.forEach(l => {
            if (l.text.length > 2) {
                console.log(`- ${l.text}: ${l.href}`);
            }
        });

    } catch (e) {
        console.error(`❌ Erro: ${e.message}`);
    } finally {
        await browser.close();
    }
}

getKjuLinks();
