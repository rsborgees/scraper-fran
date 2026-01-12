const SELLER_CODE = "7B1313";
const LINKTREE = "https://bio.site/FRANCALHEIRA";
const WHATSAPP_LINK = "https://chat.whatsapp.com/B5NunogKsnMIoyJSxMAtcN";
const { appendQueryParams } = require('./urlUtils');

function formatPrice(price) {
    if (!price || isNaN(price)) return 'R$ 0,00';
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Helper para parcelamento (simulado fixo ou calculado)
function getInstallments(price) {
    const val = (price / 10).toFixed(2).replace('.', ',');
    return `💳 10x R$ ${val}`;
}

/**
 * KJU TEMPLATE
 */
function buildKjuMessage(produto) {
    const isPromotional = produto.precoOriginal && produto.precoOriginal > produto.precoAtual;
    const priceLine = isPromotional
        ? `De ~${formatPrice(produto.precoOriginal)}~ Por *${formatPrice(produto.precoAtual)}* 🔥`
        : `Por *${formatPrice(produto.precoAtual)}* 🔥`;

    return `
⭕️ Farm na Kju 🤩‼️

${priceLine}

${produto.url}

*Cód vendedora: ${SELLER_CODE}*

🌈 Vaga pra entrar no grupo:
${LINKTREE}
`.trim();
}

/**
 * DRESS TO TEMPLATE
 */
function buildDressMessage(produto) {
    const sizes = produto.tamanhos ? produto.tamanhos.join(' ') : 'P M G';

    return `
${produto.nome}
${sizes}
Por *${formatPrice(produto.precoAtual)}*

+ código de vendedora: 5KP4

${produto.url}

🌈*Vaga pra entrar no grupo:*
${LINKTREE}
`.trim();
}

/**
 * LIVE TEMPLATE (Agrupado por Top + Bottom se possível, ou individual)
 * O User pediu "conjunto", peça de cima e peça de baixo. 
 * A função aqui aceita um array de 2 produtos (cima e baixo) ou um single.
 */
function buildLiveMessage(products) {
    // Header fixo
    let msg = `LIVE! ✨\n\n`;

    products.forEach(p => {
        const original = '';
        const link = `${p.url}?size=${p.tamanhos ? p.tamanhos[0] : 'M'}`; // Exemplo de query param para tamanho

        msg += `
${p.nome}
${original}Por *${formatPrice(p.precoAtual)}* 🔥
${getInstallments(p.precoAtual)}

${link}
`.trim() + '\n\n';
    });

    msg += `🌈*Vaga pra entrar no grupo:*

${LINKTREE}`;

    return msg.trim();
}

/**
 * FARM TEMPLATE
 * Requer verificação externa se "reloginho" está ativo.
 * Se timerAtivo = true, usa cupom do banner. Se false, usa texto padrão.
 */
function buildFarmMessage(produto, timerData = null) {
    const sizes = produto.tamanhos ? produto.tamanhos.join(' ') : 'P M G';

    // Bloco do Desconto Progressivo (Campanha Atual)
    let progressiveHeader = "";
    // Exibe se o scraper detectou a campanha OU se não temos dados (assume ativo por segurança/padrão recente)
    // Exibe SOMENTE se a campanha for explicitamente detectada
    if (timerData && timerData.progressive) {
        progressiveHeader = `Desconto Progressivo🔥

1️⃣ peça  20% off
2️⃣ peças  25% off
3️⃣ peças  30% off`;
    }

    // Verificação de Promoção (De/Por)
    const isPromotional = produto.precoOriginal && produto.precoOriginal > produto.precoAtual;

    // Lógica do Cupom
    let cupomText = "";
    // Se temos timer ativo OU campanha progressiva, motra linha de cupom
    if (timerData && (timerData.ativo || timerData.progressive)) {
        const perc = timerData.discountPercent; // ex: "25% OFF"
        const code = timerData.discountCode;    // ex: "QUERO25"

        // Prioriza EXIBIR APENAS O CUPOM se ele existir (pedido do usuário)
        if (code) {
            cupomText = `Cupom: *${code}*`;
        } else if (perc) {
            cupomText = `Cupom: *${perc} no site*`;
        } else {
            // Fallback se ativou mas não achou textos específicos
            const fallback = (timerData.cupom && timerData.cupom !== 'NO SITE') ? timerData.cupom : 'Confira o desconto no site';
            cupomText = `Cupom: *${fallback}*`;
        }
    }
    // NOTA: Se não tem cupom ativo e não é promocional, a mensagem de desconto entra no priceLine abaixo,
    // então não precisamos definir cupomText aqui.

    // Adiciona parâmetros de vendedora na URL de forma robusta usando utilitário
    const finalUrl = appendQueryParams(produto.url, {
        utm_campaign: SELLER_CODE
    });

    // Monta a linha de preço
    let priceLine;
    if (isPromotional) {
        priceLine = `De ~${formatPrice(produto.precoOriginal)}~ Por *${formatPrice(produto.precoAtual)}* 🔥`;
    } else {
        // Se NÃO for promoção (preço cheio), calcula 10% OFF manual
        const discountedPrice = produto.precoAtual * 0.9;
        priceLine = `De ~${formatPrice(produto.precoAtual)}~ Por *${formatPrice(discountedPrice)}* usando o código da vendedora 🔥`;
    }

    // Monta a mensagem final: Progressivo (se houver) -> Nome -> Tamanhos -> Preço -> Cupom -> Código -> Link -> Grupo
    const parts = [
        progressiveHeader,
        produto.nome,
        sizes,
        priceLine,
        cupomText,
        `Código Vendedora ${SELLER_CODE}`,
        finalUrl,
        `🌈*Vaga pra entrar no grupo:*`,
        LINKTREE
    ];

    // Filtra partes vazias (ex: progressiveHeader se inativo) e junta
    return parts.filter(p => p.trim() !== "").join('\n\n');
}

/**
 * ZZMALL TEMPLATE
 */
function buildZzMallMessage(produto) {
    return `
* AREZZO, SCHÜTZ, ANACAPRI, VANS, VICENZA ❤️
${produto.nome}


Por *${formatPrice(produto.precoAtual)}* 🔥

${produto.url}


💚ZZ MALL é marketplace oficial do grupo Arezzo
`.trim();
}

module.exports = {
    buildKjuMessage,
    buildDressMessage,
    buildLiveMessage,
    buildFarmMessage,
    buildZzMallMessage
};
