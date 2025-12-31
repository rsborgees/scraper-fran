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

app.listen(PORT, () => {
    console.log(`Scraper Dashboard rodando em http://localhost:${PORT}`);

    // Inicia o agendador automático (7h da manhã) ao subir o servidor
    setupDailySchedule();

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
