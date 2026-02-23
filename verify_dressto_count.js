const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const TOKEN_PATH = path.join(__dirname, 'tokens.json');

function loadAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
}

async function listDressto() {
    try {
        const auth = loadAuth();
        const drive = google.drive({ version: 'v3', auth });
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        let allFiles = [];
        let pageToken = null;

        do {
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name)',
                pageSize: 1000,
                pageToken: pageToken
            });

            allFiles = allFiles.concat(res.data.files || []);
            pageToken = res.data.nextPageToken;
        } while (pageToken);

        const dresstoFiles = allFiles.filter(f => {
            const name = f.name.toLowerCase();
            return name.includes('dress to') || name.includes('dressto') || name.includes('dress');
        });

        console.log(`\n--- DRESS TO VERIFICATION ---`);
        console.log(`Total drive files: ${allFiles.length}`);
        console.log(`Total files with 'dress' in name: ${dresstoFiles.length}`);

        // Let's see if any don't have IDs
        const withoutId = dresstoFiles.filter(f => !f.name.match(/\d{6,}/) && !f.name.match(/\d{2}\.\d{2}\.\d{4}/));
        console.log(`Files with 'dress' but NO standard ID: ${withoutId.length}`);
        if (withoutId.length > 0) {
            console.log('Sample files without ID:');
            withoutId.slice(0, 5).forEach(f => console.log(`- ${f.name}`));
        }

        const withId = dresstoFiles.filter(f => f.name.match(/\d{6,}/) || f.name.match(/\d{2}\.\d{2}\.\d{4}/));
        console.log(`Files with 'dress' AND valid ID: ${withId.length}`);

    } catch (e) {
        console.error('Erro:', e.message);
    }
}

listDressto();
