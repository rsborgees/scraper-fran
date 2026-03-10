const { initBrowser } = require('./browser_setup');
const { parseProduct } = require('./scrapers/farm/parser');
const axios = require('axios');
require('dotenv').config();

const WEBHOOK_URL = 'https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';

async function sendNewNovidades() {
    console.log('🚀 Iniciando processamento final com candidatos selecionados...');
    const { browser, page } = await initBrowser();

    // Lista de candidatos que NÃO estão no drive (identificados no passo anterior)
    const productUrls = [
        'https://www.farmrio.com.br/bermuda-bordada-alvorada-solar-off-white-355668-07448/p?brand=farm',
        'https://www.farmrio.com.br/bermuda-estampada-floral-vera-floral-vera_bege-seda-357955-55487/p?brand=farm',
        'https://www.farmrio.com.br/kimono-bordado-floral-lina-off-white-357164-0003/p?brand=farm',
        'https://www.farmrio.com.br/pantacourt-bordada-floral-lina-off-white-357168-0003/p?brand=farm',
        'https://www.farmrio.com.br/saia-ampla-vera-lenco-floral-vera_azul-parintins-356701-55486/p?brand=farm',
        'https://www.farmrio.com.br/t-shirt-media-coqueiro-calcadao-bege-seda-353106-0024/p?brand=farm',
        'https://www.farmrio.com.br/short-artesanal-listra-tropical-off-white-356924-0003/p?brand=farm',
        'https://www.farmrio.com.br/macaquinho-estampado-rio-grafico-rio-grafico_lycra-praia_multicolorido-358680-56181/p?brand=farm'
    ];

    const results = [];
    const MAX_ITEMS = 2;

    try {
        for (const url of productUrls) {
            if (results.length >= MAX_ITEMS) break;

            console.log(`🔍 Parseando [${results.length + 1}/${MAX_ITEMS}]: ${url}`);
            const product = await parseProduct(page, url);

            if (product && product.stock > 0 && !product.error) {
                // Adicionando flags
                product.novidade = true;
                product.isNovidade = true;
                product.store = 'farm';

                results.push(product);
                console.log(`✅ Sucesso: ${product.name} (R$ ${product.price})`);
            } else if (product && product.error) {
                console.log(`⚠️ Erro no parser: ${product.error}`);
            } else {
                console.log(`⚠️ Produto sem estoque ou inválido.`);
            }
        }

        if (results.length > 0) {
            console.log(`📤 Enviando ${results.length} itens para o webhook...`);
            const response = await axios.post(WEBHOOK_URL, results);
            console.log(`✅ Webhook status: ${response.status}`);
            console.log('✅ Resposta:', response.data);
        } else {
            console.log('❌ Nenhum produto válido para enviar.');
        }

    } catch (err) {
        console.error('❌ Erro no processo final:', err.message);
    } finally {
        await browser.close();
        console.log('🏁 Processo finalizado.');
    }
}

sendNewNovidades();
