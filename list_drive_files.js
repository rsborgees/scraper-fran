const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const TOKEN_PATH = path.join(__dirname, 'tokens.json');

function loadAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
}

async function listFiles() {
    try {
        const auth = loadAuth();
        const drive = google.drive({ version: 'v3', auth });
        const folderId = '1qbxff0X2IvYJpaoZTwhH0SkuRVVQRbeU';

        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 20
        });

        const files = res.data.files;
        if (files && files.length > 0) {
            console.log('Arquivos na pasta:');
            files.forEach(file => {
                console.log(`- ${file.name}`);
            });
        } else {
            console.log('Nenhum arquivo encontrado.');
        }
    } catch (e) {
        console.error('Erro:', e.message);
    }
}

listFiles();
