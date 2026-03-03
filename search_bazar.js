const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN_PATH = path.join(__dirname, 'tokens.json');

async function searchBazar() {
    const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`Searching in folder: ${folderId}`);

    const res = await drive.files.list({
        q: `'${folderId}' in parents and name contains 'bazar' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 100
    });

    console.log('Results:', JSON.stringify(res.data.files, null, 2));
}

searchBazar().catch(console.error);
