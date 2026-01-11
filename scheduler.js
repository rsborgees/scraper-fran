const { scanFarmPromo, scanBazar } = require('./farmScanner');
const { distributeLinks } = require('./distributionEngine');
const { buildFarmMessage, buildKjuMessage, buildDressMessage, buildLiveMessage, buildZzMallMessage } = require('./messageBuilder');

/**
 * Gera a cronograma diário de mensagens.
 * @param {Array} availableProducts - Lista de produtos já parseados (mock ou real).
 * @returns {Promise<Array>} Timeline ordenada.
 */
async function generateDailySchedule(availableProducts) {
    const schedule = [];
    const now = new Date(); // Referência para construção de datas

    function addEvent(timeStr, type, content) {
        schedule.push({ time: timeStr, type, content });
    }

    console.log('--- Gerando Scheduler Diário ---');

    // 1. 09:00 - Bom dia + Resumo Promoções
    // Executa scanner real para obter dados frescos
    const promoHome = await scanFarmPromo();
    const promoBazar = await scanBazar();

    let morningText = "☀️ *Bom dia!* As melhores ofertas de hoje:\n\n";
    if (promoHome && promoHome.descricao) {
        morningText += `🔥 *Destaque*: ${promoHome.titulo}\n${promoHome.descricao}\n`;
    }
    if (promoBazar && promoBazar.desconto) {
        morningText += `🛍️ *Bazar*: ${promoBazar.desconto} OFF - ${promoBazar.descricao}\n`;
    } else {
        morningText += `🛍️ *Bazar*: Confira as remarcações do dia!\n`;
    }

    addEvent('09:00', 'system', morningText);

    // 2. 09:10 até 21:50 - Distribuição de Produtos
    const dailyMix = distributeLinks(availableProducts);

    // Total de minutos úteis: (21*60 + 50) - (9*60 + 10) = 1310 - 550 = 760 minutos
    // Para 120 links: intervalo de ~6.3 minutos
    // Vamos simplificar para intervalos de 6 minutos para caber

    let currentHour = 9;
    let currentMinute = 15;

    for (const product of dailyMix) {
        let msg = '';
        const promoResumo = promoHome ? promoHome.titulo : 'Oferta do dia';

        switch (product.brand) {
            case 'FARM': msg = buildFarmMessage(product, promoResumo); break;
            case 'KJU': msg = buildKjuMessage(product); break;
            case 'DRESS': msg = buildDressMessage(product); break;
            case 'LIVE': msg = buildLiveMessage([product]); break; // Adapter para array
            case 'ZZMALL': msg = buildZzMallMessage(product); break;
            default: msg = `Oferta: ${product.nome} - R$ ${product.precoAtual}`;
        }

        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        addEvent(timeStr, 'product', msg);

        // Incrementa tempo
        currentMinute += 6;
        if (currentMinute >= 60) {
            currentMinute -= 60;
            currentHour += 1;
        }

        // Safety break se passar das 22h
        if (currentHour >= 22) break;
    }

    // 3. 22:00 - Boa noite
    addEvent('22:00', 'system', '🌙 *Boa noite!* O grupo fecha agora e reabre amanhã às 09h.');

    // 4. 22:02 - Cupons Finais / Encerramento
    addEvent('22:02', 'system', '🎟️ *Última chance*: Use o cupom R892 para garantir frete grátis nas compras da madrugada!');

    return schedule;
}

module.exports = { generateDailySchedule };
