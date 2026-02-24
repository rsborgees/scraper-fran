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

async function listSamples() {
    const auth = loadAuth();
    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(name)',
        pageSize: 1000
    });

    const files = res.data.files;
    console.log('--- AMOSTRA DE ARQUIVOS ---');

    const keywords = ['fav', 'nov', 'loja', 'farm', 'dress', 'kju', 'live', 'zz'];

    files.forEach(f => {
        const name = f.name.toLowerCase();
        if (keywords.some(k => name.includes(k))) {
            // console.log(f.name);
        }
    });

    // Count occurrences of possible keywords
    const stats = {};
    files.forEach(f => {
        const name = f.name.toLowerCase();
        ['favorito', 'novidade', 'bazar', 'farm', 'dress', 'kju', 'live', 'zzmall'].forEach(k => {
            if (name.includes(k)) stats[k] = (stats[k] || 0) + 1;
        });
    });

    console.log('Contagem por Palavra-Chave:', stats);

    console.log('\nExemplos de Favoritos:');
    files.filter(f => f.name.toLowerCase().includes('favorito')).slice(0, 10).forEach(f => console.log(`- ${f.name}`));

    console.log('\nExemplos de Novidades:');
    files.filter(f => f.name.toLowerCase().includes('novidade')).slice(0, 10).forEach(f => console.log(`- ${f.name}`));

    console.log('\nArquivos que NÃO têm "favorito" nem "novidade":');
    files.filter(f => !f.name.toLowerCase().includes('favorito') && !f.name.toLowerCase().includes('novidade')).slice(0, 10).forEach(f => console.log(`- ${f.name}`));
}

listSamples().catch(console.error);
