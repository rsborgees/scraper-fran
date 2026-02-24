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

async function deepCheck() {
    const auth = loadAuth();
    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(name)',
        pageSize: 1000
    });

    const files = res.data.files;

    const results = [];

    files.forEach(f => {
        const name = f.name.toLowerCase();

        // Detecção de Loja (Baseado no driveManager.js)
        let store = 'desconhecida';
        if (name.includes('farm')) store = 'farm';
        else if (name.includes('dress to') || name.includes('dressto') || name.includes('dress')) store = 'dressto';
        else if (name.includes('kju')) store = 'kju';
        else if (name.includes('zzmall') || name.includes('zz mall')) store = 'zzmall';
        else if (name.includes('live')) store = 'live';

        // Detecção de Categorias
        // Verificando variações comuns
        const isFavorito = name.includes('favorit') || name.includes('fav');
        const isNovidade = name.includes('novidade') || name.includes('nov');
        const isBazar = name.includes('bazar') || name.includes('baz');

        results.push({ name: f.name, store, isFavorito, isNovidade, isBazar });
    });

    const summary = {};
    const favsOutrasLojas = [];
    const novsOutrasLojas = [];

    results.forEach(r => {
        if (!summary[r.store]) summary[r.store] = { total: 0, favoritos: 0, novidades: 0, bazar: 0 };
        summary[r.store].total++;
        if (r.isFavorito) summary[r.store].favoritos++;
        if (r.isNovidade) summary[r.store].novidades++;
        if (r.isBazar) summary[r.store].bazar++;

        if (r.store !== 'farm' && r.isFavorito) favsOutrasLojas.push(r.name);
        if (r.store !== 'farm' && r.isNovidade) novsOutrasLojas.push(r.name);
    });

    console.log('--- VERIFICAÇÃO PROFUNDA ---');
    console.log(JSON.stringify(summary, null, 2));

    if (favsOutrasLojas.length > 0) {
        console.log('\nFavoritos em outras lojas found:');
        favsOutrasLojas.forEach(n => console.log(`- ${n}`));
    } else {
        console.log('\nNenhum favorito encontrado fora da Farm.');
    }

    if (novsOutrasLojas.length > 0) {
        console.log('\nNovidades em outras lojas found:');
        novsOutrasLojas.forEach(n => console.log(`- ${n}`));
    }
}

deepCheck().catch(console.error);
