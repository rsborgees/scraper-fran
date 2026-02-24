const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN_PATH = path.join(__dirname, 'tokens.json');

function loadAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000/oauth2callback');
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
}

async function smartCount() {
    const auth = loadAuth();
    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1000
    });

    const files = res.data.files;

    const summary = {
        farm: { total: 0, favoritos: 0, novidades: 0, bazar: 0 },
        dressto: { total: 0, favoritos: 0, novidades: 0, bazar: 0 },
        kju: { total: 0, favoritos: 0, novidades: 0, bazar: 0 },
        live: { total: 0, favoritos: 0, novidades: 0, bazar: 0 },
        zzmall: { total: 0, favoritos: 0, novidades: 0, bazar: 0 },
        ignorado: 0
    };

    files.forEach(f => {
        const name = f.name.toLowerCase();

        // Detecção de Categorias
        const isFavorito = name.includes('favorito');
        const isNovidade = name.includes('novidade');
        const isBazar = name.includes('bazar');

        let store = null;

        // 1. Detecção Explícita
        if (name.includes('farm')) store = 'farm';
        else if (name.includes('dress to') || name.includes('dressto') || name.includes('dress')) store = 'dressto';
        else if (name.includes('kju')) store = 'kju';
        else if (name.includes('zzmall') || name.includes('zz mall') || name.includes('zz')) store = 'zzmall';
        else if (name.includes('live')) store = 'live';

        // 2. Detecção por Padrão de ID (se não detectado explicitamente)
        if (!store) {
            const genericIdPattern = /\d{6}/;
            const dressPattern = /\d{2}\.\d{2}\.\d{4}/;
            const liveKeywords = ['hydefit', 'allure', 'athletic', 'seamless', 'legging', 'top move', 'shorts fit'];

            if (dressPattern.test(name)) {
                store = 'dressto';
            } else if (genericIdPattern.test(name)) {
                // IDs de 6 dígitos começando com 3 (Farm)
                const idMatch = name.match(/(\d{6})/);
                if (idMatch && idMatch[1].startsWith('3')) {
                    store = 'farm';
                }
            } else if (liveKeywords.some(k => name.includes(k))) {
                store = 'live';
            }
        }

        if (store && summary[store]) {
            summary[store].total++;
            if (isFavorito) summary[store].favoritos++;
            if (isNovidade) summary[store].novidades++;
            if (isBazar) summary[store].bazar++;
        } else {
            summary.ignorado++;
            // console.log(`Ignorado: ${f.name}`);
        }
    });

    console.log('--- CONTAGEM INTELIGENTE ---');
    console.log(JSON.stringify(summary, null, 2));
}

smartCount().catch(console.error);
