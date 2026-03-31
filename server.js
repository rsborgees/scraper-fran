const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const { setupDailySchedule } = require("./cronScheduler");
const { checkFarmTimer } = require("./scrapers/farm/timer_check");

const app = express();
const PORT = process.env.PORT || 3000;

// Estado em memória
let running = false;
let logs = [];

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, "public")));

// Endpoint para verificar status e pegar logs
app.get("/status", (req, res) => {
    res.json({
        running,
        logs: logs.slice(-100) // Retorna as últimas 100 linhas
    });
});

app.post("/run", (req, res) => {
    if (running) {
        return res.status(409).json({ ok: false, message: "Scraper já em execução" });
    }

    running = true;
    logs = []; // Limpa logs anteriores
    logs.push(`[${new Date().toLocaleTimeString()}] Iniciando scraper...`);

    const scraperProcess = spawn("node", ["index.js"]);

    // Captura stdout
    scraperProcess.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        lines.forEach(line => {
            if (line.trim()) {
                console.log(line); // Mantém log no terminal do server
                logs.push(line);
            }
        });
    });

    // Captura stderr
    scraperProcess.stderr.on("data", (data) => {
        const lines = data.toString().split("\n");
        lines.forEach(line => {
            if (line.trim()) {
                console.error(line);
                logs.push(`[ERROR] ${line}`);
            }
        });
    });

    // Finalização
    scraperProcess.on("close", (code) => {
        running = false;
        logs.push(`[${new Date().toLocaleTimeString()}] Processo finalizado com código ${code}`);
        console.log(`Scraper finalizado com código ${code}`);
    });

    res.json({ ok: true, message: "Scraper iniciado" });
});

app.use(express.json({ limit: '10mb' })); // Support large history files

app.post("/import-history", (req, res) => {
    try {
        const historyData = req.body;
        if (!historyData || !historyData.sent_ids) {
            return res.status(400).json({ ok: false, message: "Formato inválido. Esperado objeto com sent_ids." });
        }

        const fs = require('fs');
        const path = require('path');
        const DATA_DIR = path.join(__dirname, 'data');
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

        const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

        // Backup existing if any
        if (fs.existsSync(HISTORY_FILE)) {
            fs.copyFileSync(HISTORY_FILE, path.join(DATA_DIR, `history.backup.${Date.now()}.json`));
        }

        fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));
        console.log(`📥 Histórico importado manualmente via API (${Object.keys(historyData.sent_ids).length} itens)`);

        res.json({ ok: true, message: "Histórico importado com sucesso!", count: Object.keys(historyData.sent_ids).length });
    } catch (e) {
        console.error("Erro ao importar histórico:", e);
        res.status(500).json({ ok: false, message: e.message });
    }
});

// Endpoint para baixar o histórico atual do servidor
app.get("/history", (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');

    if (fs.existsSync(HISTORY_FILE)) {
        res.download(HISTORY_FILE, 'history.json');
    } else {
        res.status(404).json({ ok: false, message: "Arquivo history.json não encontrado" });
    }
});

// Endpoint de teste para Live scraper (diagnóstico)
app.post("/test-live", async (req, res) => {
    const logs = [];
    const log = (msg) => {
        console.log(msg);
        logs.push(msg);
    };

    try {
        log('🧪 TESTE LIVE SCRAPER - INICIANDO...');
        log(`Ambiente: ${process.platform}, HEADLESS: ${process.env.HEADLESS}`);

        // 1. Verificar Drive
        log('\n📂 Verificando itens Live no Drive...');
        const { getExistingIdsFromDrive } = require('./driveManager');
        const allItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
        const liveItems = allItems.filter(i => i.store === 'live');

        log(`✅ Encontrados ${liveItems.length} itens Live no Drive`);
        liveItems.forEach((item, i) => {
            log(`   ${i + 1}. "${item.name}" (searchByName: ${item.searchByName})`);
        });

        if (liveItems.length === 0) {
            return res.json({ ok: false, message: 'Nenhum item Live no Drive', logs });
        }

        // 2. Testar scraper
        log('\n🔍 Testando scraper com 1 item...');
        const { scrapeSpecificIdsGeneric } = require('./scrapers/idScanner');
        const { initBrowser } = require('./browser_setup');

        const { context, browser } = await initBrowser();

        try {
            const testItem = liveItems.slice(0, 1);
            log(`Processando: "${testItem[0].name}"`);

            const result = await scrapeSpecificIdsGeneric(context, testItem, 'live', 1);

            log(`\n✅ Resultado:`);
            log(`   Capturados: ${result.products.length}`);
            log(`   Stats: ${JSON.stringify(result.stats)}`);

            if (result.products.length > 0) {
                const p = result.products[0];
                log(`\n   Produto:`);
                log(`      ID: ${p.id}`);
                log(`      Nome: ${p.nome}`);
                log(`      Preço: R$ ${p.preco}`);
                log(`      Tamanhos: ${p.tamanhos?.join(', ')}`);
                log(`      Imagem Drive: ${p.imagePath ? 'SIM' : 'NÃO'}`);
            }

            await browser.close();

            res.json({
                ok: true,
                message: 'Teste concluído',
                captured: result.products.length,
                stats: result.stats,
                logs
            });

        } catch (scraperError) {
            await browser.close();
            throw scraperError;
        }

    } catch (error) {
        log(`\n❌ ERRO: ${error.message}`);
        log(error.stack);
        res.status(500).json({ ok: false, message: error.message, logs });
    }
});


app.listen(PORT, () => {
    console.log(`Scraper Dashboard rodando em http://localhost:${PORT}`);

    // Inicia o agendador automático (7h da manhã) ao subir o servidor
    if (typeof setupDailySchedule === 'function') {
        setupDailySchedule();
    } else {
        console.error('\n❌ ERRO CRÍTICO: setupDailySchedule não foi carregado corretamente do cronScheduler.js');
        console.log('Tipo detectado:', typeof setupDailySchedule);
    }

    // DEBUG: Informar caminho exato para configurar volume
    const path = require('path');
    const DATA_DIR = path.join(__dirname, 'data');
    console.log('\n==================================================');
    console.log('📂 CONFIGURAÇÃO DE PERSISTÊNCIA (EASYPANEL)');
    console.log(`Para salvar o histórico, crie um VOLUME montado em:`);
    console.log(`👉 ${DATA_DIR}`);
    console.log('==================================================\n');

    // 🕒 O monitoramento do cronômetro Farm (Reloginho) agora é gerenciado pelo cronScheduler (setupDailySchedule)
    checkFarmTimer().catch(err => console.error('Erro no timer_check inicial:', err));
});


// Debug: Prevent process from exiting
setInterval(() => {
    // Keep-alive
}, 10000);

process.on('exit', (code) => {
    console.log(`Processo saindo com código: ${code}`);
});

process.on('SIGTERM', () => {
    console.log('Recebido SIGTERM');
    process.exit(0);
});
