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

app.listen(PORT, () => {
    console.log(`Scraper Dashboard rodando em http://localhost:${PORT}`);

    // Inicia o agendador automático (7h da manhã) ao subir o servidor
    setupDailySchedule();

    // DEBUG: Informar caminho exato para configurar volume
    const path = require('path');
    const DATA_DIR = path.join(__dirname, 'data');
    console.log('\n==================================================');
    console.log('📂 CONFIGURAÇÃO DE PERSISTÊNCIA (EASYPANEL)');
    console.log(`Para salvar o histórico, crie um VOLUME montado em:`);
    console.log(`👉 ${DATA_DIR}`);
    console.log('==================================================\n');

    // 🕒 Inicia monitoramento do cronômetro Farm (30 em 30 min)
    console.log('🕒 Iniciando monitoramento de cronômetro Farm...');
    checkFarmTimer(); // Primeira execução imediata
    setInterval(() => {
        checkFarmTimer().catch(err => console.error('Erro no timer_check (setInterval):', err));
    }, 60 * 60 * 1000); // 1 hora (60 minutos)
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
