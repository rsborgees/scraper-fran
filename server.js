const express = require("express");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

let running = false;

app.post("/run", (req, res) => {
    if (running) {
        return res.status(409).json({ ok: false, message: "scraper já em execução" });
    }

    running = true;

    exec("node index.js", (error, stdout, stderr) => {
        running = false;

        if (error) {
            console.error("Erro no scraper:", error);
            return res.status(500).json({ ok: false });
        }

        console.log("Scraper finalizado:");
        console.log(stdout);
        res.json({ ok: true });
    });
});

app.get("/", (_, res) => {
    res.send("scraper online");
});

app.listen(PORT, () => {
    console.log(`scraper escutando na porta ${PORT}`);
});
