
const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { buildFarmMessage } = require('./messageBuilder');
const { initBrowser } = require('./browser_setup');
const { sendToWebhook } = require('./cronScheduler');
const { checkFarmTimer } = require('./scrapers/farm/timer_check');
require('dotenv').config();

async function sendFarmBatchNovidades() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
        console.error('❌ Folder ID not found in .env');
        return;
    }

    console.log('🚀 INICIANDO ENVIO DE NOVIDADES FARM (BATCH MODE)\n');

    const { browser, context } = await initBrowser();

    try {
        console.log(`📂 Buscando arquivos na pasta: ${folderId}`);
        const allDriveItems = await getExistingIdsFromDrive(folderId);

        const novidadesCandidatos = allDriveItems.filter(item =>
            item.store === 'farm' && item.novidade
        );

        console.log(`✨ Encontradas ${novidadesCandidatos.length} novidades no Drive.`);

        if (novidadesCandidatos.length === 0) {
            console.log('⚠️ Nenhuma novidade para enviar.');
            return;
        }

        const timerData = await checkFarmTimer();

        // Faz o scrape de tudo primeiro (com ignoreHistory para garantir as 39 peças)
        const { products } = await scrapeSpecificIds(context, novidadesCandidatos, 999, null, { ignoreHistory: true });

        console.log(`\n✅ ${products.length} produtos capturados com sucesso.`);

        if (products.length === 0) {
            console.log('⚠️ Nenhum produto encontrado para envio.');
            return;
        }

        // Constrói as mensagens para todos
        products.forEach(p => {
            p.message = buildFarmMessage(p, timerData);
        });

        // Envia tudo em um único webhook payload
        console.log(`📤 Enviando lote de ${products.length} produtos para webhook...`);
        const result = await sendToWebhook(products);

        if (result.success) {
            console.log('\n🌟 LOTE ENVIADO COM SUCESSO!');
        } else {
            console.log('\n❌ Erro ao enviar lote para o webhook.');
        }

    } catch (error) {
        console.error('❌ Erro crítico:', error);
    } finally {
        await browser.close();
        console.log('\n🏁 Processo finalizado.');
    }
}

sendFarmBatchNovidades();
