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

async function listDesconhecidos() {
    const auth = loadAuth();
    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(name)',
        pageSize: 1000
    });

    const files = res.data.files;

    console.log('--- ITENS DESCONHECIDOS ---');
    files.forEach(f => {
        const name = f.name.toLowerCase();
        const isFarm = name.includes('farm');
        const isDress = name.includes('dress to') || name.includes('dressto') || name.includes('dress');
        const isKju = name.includes('kju');
        const isLive = name.includes('live');
        const isZZ = name.includes('zzmall') || name.includes('zz mall');

        if (!isFarm && !isDress && !isKju && !isLive && !isZZ) {
            console.log(`- ${f.name}`);
        }
    });
}

listDesconhecidos().catch(console.error);
