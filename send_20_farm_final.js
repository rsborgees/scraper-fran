const axios = require('axios');
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildFarmMessage } = require('./messageBuilder');
const { loadHistory, normalizeId, markAsSent } = require('./historyManager');
const { sendToWebhook } = require('./cronScheduler');
require('dotenv').config();

const TARGET = 20;

async function run() {
    console.log(`\n🚀 [FINAL] INICIANDO ENVIO DE ${TARGET} ITENS NORMAIS DA FARM...\n`);

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const allDriveItems = await getExistingIdsFromDrive(folderId);
    if (!allDriveItems || allDriveItems.length === 0) {
        console.error('❌ Nenhum item encontrado no Drive.');
        return;
    }

    const history = loadHistory();

    // FILTRO: Apenas Normais da Farm
    const candidates = allDriveItems.filter(item => 
        item.store === 'farm' && 
        !item.isFavorito && !item.favorito &&
        !item.novidade && !item.isNovidade &&
        !item.bazar && !item.isBazar
    );

    console.log(`✅ Encontrados ${candidates.length} candidatos normais no Drive.`);

    if (candidates.length === 0) {
        console.log('⚠️ Nenhum candidato normal encontrado.');
        return;
    }

    // Ordenação por novidade no DRIVE (mais recentes primeiro)
    // Itens novos no drive têm muito mais chance de estarem ativos na loja.
    candidates.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

    // Inicializar navegador mestre
    const { browser, context } = await initBrowser();

    try {
        // Scrape usando o idScanner robusto
        // Scrape usando o idScanner robusto
        // maxAgeHours: -1 para forçar o reenvio (ignorar histórico de hoje)
        const { products } = await scrapeSpecificIds(context, candidates, TARGET, { maxAgeHours: -1 });

        if (products.length === 0) {
            console.log('⚠️ Nenhum produto encontrado ativo na API/Site.');
            return;
        }

        const finalProducts = products.slice(0, TARGET);
        console.log(`\n📦 Total coletado com sucesso: ${finalProducts.length} produtos.`);

        // Gerar mensagens e garantir flags
        finalProducts.forEach(p => {
            p.message = buildFarmMessage(p, null);
            p.loja = 'farm';
        });

        // Enviar para Webhook principal DIRETAMENTE (Como array, sem o wrapper summary/products)
        const WEBHOOK_URL = 'https://n8n-francalheira.vlusgm.easypanel.host/webhook/1959ec08-24d1-4402-b458-8b56b8211caa';
        console.log(`📤 Enviando ${finalProducts.length} itens DIRETAMENTE para o webhook...`);
        
        const response = await axios.post(WEBHOOK_URL, finalProducts, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });

        console.log(`✅ Webhook enviado! Status: ${response.status}`);
        // Marcar como enviado no histórico (embora aqui tenhamos forçado, é bom manter atualizado)
        const allIds = finalProducts.map(p => p.id);
        markAsSent(allIds);

    } catch (err) {
        console.error('❌ Erro durante a execução:', err.message);
    } finally {
        await browser.close();
        console.log('🔒 Navegador encerrado.');
        process.exit(0);
    }
}

run().catch(e => {
    console.error('❌ Erro Fatal:', e);
    process.exit(1);
});
