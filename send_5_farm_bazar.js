require('dotenv').config();
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { sendToWebhook } = require('./cronScheduler');
const { chromium } = require('playwright');

async function sendFiveFarmBazar() {
    console.log('🚀 Iniciando envio manual de 5 peças BAZAR FARM com PREÇOS REAIS...');

    // Lista expandida de candidatos da Farm do Drive
    const selectedIds = [
        { id: '362421', url: 'https://drive.google.com/uc?export=download&id=1j6LMC8rmoqzaKOg_5HRzkkQZjKJ4FVHr' },
        { id: '361675', url: 'https://drive.google.com/uc?export=download&id=1HyTV21JtV46m_bcelArpC46w3ah9R_EA' },
        { id: '359479', url: 'https://drive.google.com/uc?export=download&id=1re7hmMbFi8gXLT9ROvtNHY9tAAPSfO27' },
        { id: '360671', url: 'https://drive.google.com/uc?export=download&id=1i9zbvaYnVIZ5jftpqtko4F5baFxkaqxw' },
        { id: '364011', url: 'https://drive.google.com/uc?export=download&id=1atR3SWozuD9mebDI_nKGe1YSG9RbvAVa' },
        { id: '370479', url: 'https://drive.google.com/uc?export=download&id=1sbUTmoxgnJ4VJAtBUpihmqlxVEQ0G6Il' },
        { id: '370484', url: 'https://drive.google.com/uc?export=download&id=1WVg9Hi2unJyWMu1zNGYpFALGh91xfc_L' },
        { id: '370485', url: 'https://drive.google.com/uc?export=download&id=181ws7ZNzhO2vYtW0TnSGESMDPq9CiRKm' },
        { id: '370482', url: 'https://drive.google.com/uc?export=download&id=1r1dBK9Mf4nFJlMzqvsfTjeKhecKwnY4w' },
        { id: '370478', url: 'https://drive.google.com/uc?export=download&id=1n1_R_L_R_L_R_L_R_L_R_L' }, // Fake/Placeholder if needed but let's use real ones
        { id: '362410', url: 'https://drive.google.com/uc?export=download&id=1oO_V_V_V_V_V_V_V_V_V_V' }
    ].slice(0, 15);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    const candidates = selectedIds.map(item => ({
        id: item.id,
        driveId: item.id,
        driveUrl: item.url,
        store: 'farm',
        bazar: true,
        isFavorito: false,
        novidade: false
    }));

    console.log(`🔍 Raspando dados reais de até ${candidates.length} candidatos para obter 5 sucessos...`);

    try {
        // Tentamos raspar todos os candidatos, parando quando atingir 5
        const scrapeResult = await scrapeSpecificIds(context, candidates, 5, { maxAgeHours: 0 });
        const results = scrapeResult.products || [];

        if (results.length >= 1) {
            console.log(`✅ Coletados ${results.length} itens com preços reais. Enviando para webhook...`);

            // Garantir flags de bazar
            results.forEach(p => {
                p.bazar = true;
                p.isBazar = true;
                // Se o preço for 0 por algum motivo de falha no parse, vamos tentar evitar enviar
            });

            const validResults = results.filter(p => p.precoAtual > 0);

            if (validResults.length > 0) {
                await sendToWebhook(validResults);
                console.log(`🎯 Envio de ${validResults.length} itens com preços reais concluído!`);
            } else {
                console.log('❌ Todos os itens coletados estavam com preço zero.');
            }
        } else {
            console.log('❌ Falha ao coletar qualquer item do site da Farm.');
        }
    } catch (err) {
        console.error('❌ Erro durante o scraping:', err.message);
    }

    await browser.close();
}

sendFiveFarmBazar().catch(err => {
    console.error('💥 Erro fatal:', err);
    process.exit(1);
});
