const SELLER_CODE = "7B1313";
const LINKTREE = "https://linktr.ee/FranNaFarm";
const WHATSAPP_LINK = "https://chat.whatsapp.com/B5NunogKsnMIoyJSxMAtcN";

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
    const original = produto.precoOriginal ? `De ~${formatPrice(produto.precoOriginal)}~ ` : '';

    return `
⭕️ Lançamento na Kju 🤩‼️
${produto.nome}

 ${original}Por *${formatPrice(produto.precoAtual)}* 🔥
+ 10% extra no pix  💰

Cód vendedora: ${SELLER_CODE}

${produto.url}
🌈*Vaga pra entrar no grupo:*

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

✨ Primeira compra: BEMVINDA15

✨ Aniversariante : ANIVERDEZ15

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
    if (!timerData || timerData.progressive) {
        progressiveHeader = `Desconto Progressivo🔥

1️⃣ peça  20% off
2️⃣ peças  25% off
3️⃣ peças  30% off`;
    }

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
    } else {
        // Fallback apenas se não houver NENHUMA campanha ativa
        cupomText = "10% off comprando pelo link e usando código da vendedora";
    }

    // Adiciona parâmetros de vendedora na URL de forma robusta
    let finalUrl = produto.url;
    if (!finalUrl.includes('utm_campaign')) {
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${separator}brand=farm&utm_campaign=${SELLER_CODE}&utm_source=vendedoras&utm_medium=organico`;
    }

    // Monta a mensagem final: Progressivo (se houver) -> Nome -> Tamanhos -> Preço -> Cupom -> Código -> Link -> Grupo
    const parts = [
        progressiveHeader,
        produto.nome,
        sizes,
        `De ~${formatPrice(produto.precoOriginal)}~ Por *${formatPrice(produto.precoAtual)}* 🔥`,
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

10% EXTRA usando meu voucher  ZZCUPOM4452  ⁠🎟️

(ISSO AQUI PEGA NO LINK DO PRODUTO: TAMANHOS E PREÇO)
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
