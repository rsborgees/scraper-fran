const { initBrowser } = require('../../browser_setup');

async function getPromoSummary() {
    const { browser, page } = await initBrowser();

    try {
        console.log('🔍 Escaneando promoções do dia para gerar Copy...');

        // 1. SCAN HOME
        await page.goto('https://www.farmrio.com.br/?utm_campaign=7B1313', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const mainData = await page.evaluate(() => {
            const texts = [];
            // Scan for main promo keywords
            document.body.innerText.split('\n').forEach(line => {
                const txt = line.trim();
                if (txt.length > 5 && txt.length < 100) {
                    if (/(off|%|desconto|progressiva|liqui|verão)/i.test(txt)) {
                        if (!/trocar|devolvida|pedidos|ajuda|login|sac/i.test(txt.toLowerCase())) {
                            texts.push(txt);
                        }
                    }
                }
            });

            // Scan images
            const images = [];
            document.querySelectorAll('img').forEach(img => {
                if (img.width > 300) {
                    const alt = img.alt || img.title || '';
                    if (/(off|%|desconto|liqui|progressiva)/i.test(alt)) images.push(alt);
                }
            });

            return { texts: [...new Set(texts)], images: [...new Set(images)] };
        });

        // 2. SCAN BAZAR
        await page.goto('https://www.farmrio.com.br/bazar?utm_campaign=7B1313', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const bazarData = await page.evaluate(() => {
            const texts = [];
            // Specific keywords for Bazar
            const keywords = /(tudo com|todo o bazar|remarcado|adoro bazar|% off)/i;

            document.body.innerText.split('\n').forEach(line => {
                const txt = line.trim();
                // Prioritize "TUDO COM X%" or "ADORO BAZAR"
                if (keywords.test(txt) && txt.length < 100) {
                    texts.push(txt);
                }
            });

            // Try to find the specific banner image text if meaningful
            const images = [];
            document.querySelectorAll('img').forEach(img => {
                if (img.width > 300) {
                    const alt = img.alt || img.title || '';
                    if (keywords.test(alt)) images.push(alt);
                }
            });

            return { texts: [...new Set(texts)], images: [...new Set(images)] };
        });

        // --- INTELLIGENCE LOGIC ---

        // Analyze HOME
        let mainHeadline = "Novidades na Farm";
        let mainSub = "Confira as peças incríveis da nova coleção.";

        // Prioritize "Progressiva" or "Até X%"
        const allMain = [...mainData.images, ...mainData.texts];
        const progressive = allMain.find(t => /progressiva/i.test(t));
        const percentage = allMain.find(t => /até\s*\d+%/i.test(t)) || allMain.find(t => /\d+%/.test(t));

        if (progressive) {
            mainHeadline = progressive.toUpperCase();
            mainSub = "Desconto progressivo: leve mais e pague menos!";
        } else if (percentage) {
            mainHeadline = percentage.toUpperCase();
            mainSub = `Seleção especial com ${percentage.match(/(\d+%)/)[0]} OFF. Aproveite!`;
        }

        // Analyze BAZAR
        // We know from image it says "ADORO BAZAR - TUDO COM 50% OFF"
        // Let's try to find that dynamically, or fallback to the found "50%"
        let bazarHeadline = "BAZAR FARM";
        let bazarSub = "Peças com descontos especiais.";

        const bazarAll = [...bazarData.images, ...bazarData.texts];

        // Look for "TUDO COM" pattern first (Strongest)
        const everythingWith = bazarAll.find(t => /tudo com\s*\d+%/i.test(t));
        // Look for "50% OFF" or high percentage
        const justPercent = bazarAll.find(t => /\d+%\s*off/i.test(t));

        if (everythingWith) {
            const pct = everythingWith.match(/\d+%/)[0];
            bazarHeadline = `BAZAR COM TUDO ${pct} OFF`;
            bazarSub = `${pct} off remarcado em todo o bazar.`;
        } else if (justPercent) {
            const pct = justPercent.match(/\d+%/)[0];
            bazarHeadline = `BAZAR COM ${pct} OFF`;
            bazarSub = `${pct} off remarcado em todo o bazar.`;
        } else {
            // Fallback if scraping fails to find text (text in image without alt)
            // Use the HOME text if it mentions "Até 50%" as a safe proxy
            if (mainHeadline.includes('50%')) {
                bazarHeadline = "BAZAR COM ATÉ 50% OFF";
                bazarSub = "Até 50% off remarcado em todo o bazar.";
            }
        }

        // --- FINAL COPY ASSEMBLY ---
        const copy = `
Bom diaa meninas ❤️

RESUMO DAS PROMOÇÕES

 🔥 ${mainHeadline}: ${mainSub.toUpperCase()} CONFIRA TUDO AQUI

https://www.farmrio.com.br/?utm_campaign=7B1313

🔥 ${bazarHeadline}

https://www.farmrio.com.br/bazar?utm_campaign=7B1313

*Farm na KJU*
Clica aqui e veja a promoção do momento:
https://www.kjubrasil.com/?ref=7B1313
        `.trim();

        return copy;

    } catch (err) {
        return `Erro ao gerar copy: ${err.message}`;
    } finally {
        await browser.close();
    }
}

module.exports = { getPromoSummary };
