const { initBrowser } = require('./browser_setup');
const fs = require('fs');

async function extractEvents() {
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.farmrio.com.br/novidades', { waitUntil: 'networkidle', timeout: 60000 });

        console.log('📜 Rolando...');
        await page.evaluate(() => window.scrollBy(0, 1500));
        await page.waitForTimeout(3000);

        const events = await page.evaluate(() => {
            const elts = Array.from(document.querySelectorAll('[data-event]'));
            return elts.map(el => {
                try {
                    return JSON.parse(decodeURIComponent(el.getAttribute('data-event')));
                } catch (e) {
                    return el.getAttribute('data-event');
                }
            });
        });

        console.log(`✅ Total de eventos encontrados: ${events.length}`);

        const productEvents = events.filter(e => e.name === 'select_item' || e.name === 'view_item' || (e.event === 'select_content' && e.content_type?.includes('produto')));
        console.log('✅ Eventos de produto:', JSON.stringify(productEvents.slice(0, 10), null, 2));

        // Let's also find all links that are inside an element with data-event
        const linkWithEvents = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('[data-event]').forEach(container => {
                const links = Array.from(container.querySelectorAll('a'));
                const event = container.getAttribute('data-event');
                links.forEach(a => results.push({ href: a.href, event }));
            });
            return results;
        });

        console.log('✅ Links com eventos associados (primeiros 10):', JSON.stringify(linkWithEvents.slice(0, 10), null, 2));

    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

extractEvents();
