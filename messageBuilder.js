const SELLER_CODE = "7B1313";
const LINKTREE = "https://bio.site/FRANCALHEIRA";
const WHATSAPP_LINK = "https://chat.whatsapp.com/B5NunogKsnMIoyJSxMAtcN";
const { appendQueryParams, normalizeFarmUrl } = require('./urlUtils');

function formatPrice(price) {
    if (!price || isNaN(price)) return 'R$ 0,00';
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Helper para parcelamento (simulado fixo ou calculado)
function getInstallments(price) {
    if (!price || isNaN(price) || price === 0) return '';
    const val = (price / 10).toFixed(2).replace('.', ',');
    return `💳 10x R$ ${val}`;
}

/**
 * KJU TEMPLATE
 */
function buildKjuMessage(produto) {
    const isPromotional = produto.precoOriginal && (produto.precoOriginal > produto.precoAtual);

    let priceLine;
    if (isPromotional) {
        priceLine = `De ~${formatPrice(produto.precoOriginal)}~ Por *${formatPrice(produto.precoAtual)}* 🔥`;
    } else {
        // User Request: "só colocar por" se não tiver promoção
        priceLine = `Por *${formatPrice(produto.precoAtual)}* 🔥`;
    }

    const driveSizeMsg = produto.driveSize ? `Meu (Fran) tamanho ideal: ${produto.driveSize}\n` : '';

    return `
⭕️ Farm na Kju 🤩‼️

${priceLine}
${driveSizeMsg}
${produto.url}

*Cód vendedora: ${SELLER_CODE}*

🌈 Vaga pra entrar no grupo:
${LINKTREE}
`.trim();
}

/**
 * DRESS TO TEMPLATE
 */
function buildDressMessage(p) {
    const sizes = p.tamanhos ? p.tamanhos.join(' ') : 'P M G';
    const precoVal = p.precoAtual || p.preco || 0;
    const precoOldVal = p.precoOriginal || precoVal;
    const prodUrl = p.url || p.link || '#';
    const isPromotional = precoOldVal > precoVal;

    let priceLine;
    if (isPromotional) {
        priceLine = `De ~${formatPrice(precoOldVal)}~ Por *${formatPrice(precoVal)}* 🔥`;
    } else {
        priceLine = `Por *${formatPrice(precoVal)}* 🔥`;
    }

    const driveSizeMsg = p.driveSize ? `\n\nMeu (Fran) tamanho ideal: ${p.driveSize}` : '';

    return `
${p.nome}
${sizes}${driveSizeMsg}
${priceLine}

+ código de vendedora: 5KP4

${prodUrl}

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
        const isPromotional = p.precoOriginal && (p.precoOriginal > p.precoAtual);
        let priceLine;
        if (isPromotional) {
            priceLine = `De ~${formatPrice(p.precoOriginal)}~ Por *${formatPrice(p.precoAtual)}* 🔥`;
        } else {
            priceLine = `Por *${formatPrice(p.precoAtual)}* 🔥`;
        }

        const sizes = p.tamanhos && p.tamanhos.length > 0 ? p.tamanhos.join(' ') : 'UN';
        const installments = getInstallments(p.precoAtual);

        // Final link without UTM campaign as requested
        const link = p.url;

        const driveSizeMsg = p.driveSize ? `\nMeu (Fran) tamanho ideal: ${p.driveSize}` : '';

        msg += `${p.nome}\n`;
        msg += `${priceLine} ${sizes}${driveSizeMsg}\n`;
        if (installments) msg += `${installments}\n`;
        msg += `\n${link}\n\n`;
    });

    msg += `🌈*Vaga pra entrar no grupo:*\n\n${LINKTREE}`;

    return msg.trim();
}

/**
 * FARM TEMPLATE
 * Requer verificação externa se "reloginho" está ativo.
 * Se timerAtivo = true, usa cupom do banner. Se false, usa texto padrão.
 */
function buildFarmMessage(produto, timerData = null) {
    // 1. Lógica do Cupom e Banner (Global para o post)
    let progressiveHeader = "";
    if (timerData && timerData.progressive) {
        progressiveHeader = `Desconto Progressivo🔥\n\n1️⃣ peça  20% off\n2️⃣ peças  25% off\n3️⃣ peças  30% off`;
    }

    let cupomText = "";
    if (timerData && (timerData.ativo || timerData.progressive)) {
        const code = timerData.discountCode;
        const perc = timerData.discountPercent;
        if (code) cupomText = `Cupom: *${code}*`;
        else if (perc) cupomText = `Cupom: *${perc} no site*`;
        else {
            const fallback = (timerData.cupom && timerData.cupom !== 'NO SITE') ? timerData.cupom : 'Confira o desconto no site';
            cupomText = `Cupom: *${fallback}*`;
        }
    }

    // 2. Se for Conjunto, formata cada item individualmente
    if (produto.isSet && produto.items && produto.items.length > 0) {
        let itemsMsg = "";
        produto.items.forEach((item, index) => {
            const sizes = item.tamanhos ? item.tamanhos.join(' ') : 'P M G';
            const isPromotional = item.precoOriginal && item.precoOriginal > item.precoAtual;

            let priceLine;
            if (isPromotional) {
                priceLine = `De ~${formatPrice(item.precoOriginal)}~ *${formatPrice(item.precoAtual)}*`;
            } else {
                priceLine = `Por *${formatPrice(item.precoAtual)}*`;
            }

            // Adiciona parâmetros de vendedora na URL individual
            const itemUrl = normalizeFarmUrl(appendQueryParams(item.url, { utm_campaign: SELLER_CODE }));

            itemsMsg += `*${item.nome}* ${sizes} ${priceLine}\n${itemUrl}\n\n`;
        });

        const driveSizeMsg = produto.driveSize ? `Meu (Fran) tamanho ideal: ${produto.driveSize}` : null;

        const parts = [
            progressiveHeader,
            itemsMsg.trim(),
            driveSizeMsg,
            `Código de vendedora *${SELLER_CODE}*`,
            cupomText,
            `🌈*Vaga pra entrar no grupo:*`,
            LINKTREE
        ];

        return parts.filter(p => p && (typeof p === 'string' ? p.trim() !== "" : true)).join('\n\n');
    }

    // 3. Lógica para Produto Único (Legado/Padrão)
    const sizes = produto.tamanhos ? produto.tamanhos.join(' ') : 'P M G';
    const isPromotional = produto.precoOriginal && produto.precoOriginal > produto.precoAtual;
    const finalUrl = normalizeFarmUrl(appendQueryParams(produto.url, { utm_campaign: SELLER_CODE }));

    let priceLine;
    if (isPromotional) {
        priceLine = `De ~${formatPrice(produto.precoOriginal)}~ Por *${formatPrice(produto.precoAtual)}* usando o código da vendedora 🔥`;
    } else {
        priceLine = `*${formatPrice(produto.precoAtual)}* 🔥`;
    }

    const driveSizeMsg = produto.driveSize ? `Meu (Fran) tamanho ideal: ${produto.driveSize}` : null;

    const parts = [
        progressiveHeader,
        produto.nome,
        sizes,
        driveSizeMsg,
        priceLine,
        cupomText,
        `Código Vendedora ${SELLER_CODE}`,
        finalUrl,
        `🌈*Vaga pra entrar no grupo:*`,
        LINKTREE
    ];

    return parts.filter(p => p && (typeof p === 'string' ? p.trim() !== "" : true)).join('\n\n');
}

/**
 * ZZMALL TEMPLATE
 */
function buildZzMallMessage(produto) {
    const isPromotional = produto.precoOriginal && produto.precoOriginal > produto.precoAtual;
    const priceLine = isPromotional
        ? `De ~${formatPrice(produto.precoOriginal)}~ Por ${formatPrice(produto.precoAtual)}`
        : formatPrice(produto.precoAtual);

    const driveSizeMsg = produto.driveSize ? `\n\nMeu (Fran) tamanho ideal: ${produto.driveSize}` : '';

    return `
AREZZO, SCHÜTZ, ANACAPRI, VANS, VICENZA ❤️


🏷️ use o voucher ZZCUPOM4452 para aplicar desconto
${driveSizeMsg}

${priceLine}

${produto.url}

💚 ZZ MALL é marketplace oficial do grupo Arezzo
`.trim();
}

/**
 * GLOBAL MESSAGE BUILDER HELPER
 * Identifica a loja e chama o builder correto
 */
function buildMessageForProduct(p) {
    const store = (p.loja || p.brand || '').toLowerCase();

    switch (store) {
        case 'farm':
            return buildFarmMessage(p, p.timerData);
        case 'dressto':
        case 'dress':
            return buildDressMessage(p);
        case 'kju':
            return buildKjuMessage(p);
        case 'live':
            // Live expects an array
            return buildLiveMessage([p]);
        case 'zzmall':
            return buildZzMallMessage(p);
        default:
            console.warn(`⚠️ No message builder for store: ${store}`);
            return `Confira essa oferta: ${p.nome}\n${p.url || p.link}`;
    }
}

module.exports = {
    buildKjuMessage,
    buildDressMessage,
    buildLiveMessage,
    buildFarmMessage,
    buildZzMallMessage,
    buildMessageForProduct
};
