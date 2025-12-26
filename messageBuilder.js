/**
 * Construtor de Mensagens Promocionais
 */

const SELLER_CODE = "R892"; // Configuração global (exemplo)

function formatPrice(price) {
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildUTM(url, brand) {
    // Simulação de adição de UTM e código vendedor
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}utm_content=${SELLER_CODE}&vendedora=${SELLER_CODE}`;
}

/**
 * Template FARM
 */
function buildFarmMessage(produto, bannerResumo = "") {
    const desconto = Math.round(((produto.precoOriginal - produto.precoAtual) / produto.precoOriginal) * 100);

    return `
🌸 *FARM RIO* 🌸

${bannerResumo ? `📢 _${bannerResumo}_` : ''}

👗 *${produto.nome}*
Por: ${formatPrice(produto.precoAtual)}
(Era: ${formatPrice(produto.precoOriginal)})
📉 Desconto: ${desconto}% OFF

📏 Tamanhos: ${produto.tamanhos?.join(', ') || 'Consulte'}

🛒 Compre aqui: ${buildUTM(produto.url, 'FARM')}

Cód vendedora: *${SELLER_CODE}*
`.trim();
}

/**
 * Template KJU (Foco Acessórios/Roupas)
 */
function buildKjuMessage(produto) {
    return `
✨ *KJU LIFESTYLE* ✨

💎 *${produto.nome}*
Valor: ${formatPrice(produto.precoAtual)}

👉 ${buildUTM(produto.url, 'KJU')}
Cód: ${SELLER_CODE}
`.trim();
}

/**
 * Template DRESS
 */
function buildDressMessage(produto) {
    return `
💃 *DRESS TO*

🔥 *${produto.nome}*
${formatPrice(produto.precoAtual)}

Compre agora: ${buildUTM(produto.url, 'DRESS')}
Vendedora: ${SELLER_CODE}
`.trim();
}

/**
 * Template LIVE (Agrupado)
 */
function buildLiveMessage(produtos) {
    const lista = produtos.map(p => `- ${p.nome}: ${formatPrice(p.precoAtual)}`).join('\n');
    return `
🧘‍♀️ *LIVE! OFERTAS* 🧘‍♀️

${lista}

Acesse: www.liveoficial.com.br/vendedora/${SELLER_CODE}
`.trim();
}

/**
 * Template ZZMALL
 */
function buildZzMallMessage(produto) {
    return `
👠 *ZZ MALL*
*${produto.nome}*
De R$ ${produto.precoOriginal} por R$ ${produto.precoAtual}

Link: ${buildUTM(produto.url, 'ZZMALL')}
Cód: ${SELLER_CODE}
`.trim();
}

module.exports = {
    buildFarmMessage,
    buildKjuMessage,
    buildDressMessage,
    buildLiveMessage,
    buildZzMallMessage
};
