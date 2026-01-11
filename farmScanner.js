const { initBrowser } = require('./browser_setup');

/**
 * Função auxiliar para extrair texto de um elemento com segurança.
 * @param {import('playwright').Page} page 
 * @param {string} roleOrSelector 
 */
async function extractText(page, roleOrSelector) {
    // Tenta encontrar elementos visíveis e grandes que possam ser banners
    // Heurística: Elementos no topo, com texto relevante
    return await page.evaluate(() => {
        // Estratégia: Pegar todo texto visível do body e tentar achar padrões
        // Isso é mais robusto que seletores específicos que mudam
        const bodyText = document.body.innerText;
        return bodyText.split('\n').filter(line => line.trim().length > 0).slice(0, 50); // Pega as primeiras 50 linhas de texto visível
    });
}

/**
 * Analisa as linhas de texto em busca de padrões de promoção.
 * @param {string[]} lines 
 */
function analyzePromoText(lines) {
    const keywords = ["OFF", "%", "roleta", "cupom", "⏰", "bazar", "remarcado"];
    const promoLines = lines.filter(line =>
        keywords.some(keyword => line.toUpperCase().includes(keyword))
    );

    let temContagem = lines.some(line => line.match(/\d{2}h\s*:\s*\d{2}m/)); // Ex: 12h:30m
    let desconto = promoLines.find(line => line.includes('%')); // Pega primeira linha com %

    return {
        rawLines: promoLines.slice(0, 5), // Top 5 linhas mais relevantes
        temContagem,
        desconto: desconto || null,
        fullText: promoLines.join(' | ')
    };
}

async function scanFarmPromo() {
    console.log('--- Iniciando Scan: Promo Home ---');
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.farmrio.com.br/?utm_campaign=7B1313', { waitUntil: 'domcontentloaded' });
        // Espera visual para garantir que banners dinâmicos carregaram
        await page.waitForTimeout(5000);

        // Extração baseada em texto visível (mais robusto que seletores)
        const visibleLines = await extractText(page);

        if (!visibleLines || visibleLines.length === 0) {
            console.log("Dado não encontrado no DOM: Nenhuma linha de texto extraída da Home.");
            return null;
        }

        const promoData = analyzePromoText(visibleLines);

        if (!promoData.rawLines[0]) {
            console.log("Dado não encontrado no DOM: Título do banner principal não identificado.");
            return null;
        }

        const result = {
            tipo: "promo",
            titulo: promoData.rawLines[0],
            descricao: promoData.fullText,
            temContagem: promoData.temContagem,
            horario: promoData.temContagem ? "Detectado cronômetro no banner" : null
        };

        console.log('Dados extraídos (Home):', result);
        return result;

    } catch (error) {
        console.error('Erro no scanFarmPromo:', error);
        return null;
    } finally {
        await browser.close();
    }
}

async function scanBazar() {
    console.log('--- Iniciando Scan: Bazar ---');
    const { browser, page } = await initBrowser();

    try {
        await page.goto('https://www.farmrio.com.br/bazar?utm_campaign=7B1313', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const visibleLines = await extractText(page);

        // Filtra especificamente para bazar
        const bazarKeywords = ["BAZAR", "REMARCADO", "OFF"];
        const bazarLines = visibleLines.filter(line =>
            bazarKeywords.some(k => line.toUpperCase().includes(k)) || line.includes('%')
        );

        const descontoLine = bazarLines.find(line => line.includes('%'));

        if (!descontoLine) {
            console.log("Dado não encontrado no DOM: Percentual de desconto do Bazar não identificado.");
        }

        const result = {
            titulo: "BAZAR",
            desconto: descontoLine ? descontoLine.match(/(\d+%)/)[0] : null,
            descricao: bazarLines.join(' ') || null
        };

        console.log('Dados extraídos (Bazar):', result);
        return result;

    } catch (error) {
        console.error('Erro no scanBazar:', error);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = { scanFarmPromo, scanBazar };
