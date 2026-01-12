const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN_PATH = path.join(__dirname, 'tokens.json');

/**
 * Carrega a autenticação do Google Drive
 */
function loadAuth() {
    // 1. Check env vars
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Credenciais do Google não encontradas no .env');
    }

    const oAuth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost:3000/oauth2callback'
    );

    // 2. Load Tokens (Env Var JSON, individual Env Vars, or tokens.json file)
    let tokens;
    if (process.env.GOOGLE_TOKEN_JSON) {
        try {
            tokens = JSON.parse(process.env.GOOGLE_TOKEN_JSON);
            console.log('✅ [Drive] Usando tokens via GOOGLE_TOKEN_JSON.');
        } catch (e) {
            throw new Error('Variável GOOGLE_TOKEN_JSON contém um JSON inválido');
        }
    } else if (process.env.GOOGLE_REFRESH_TOKEN) {
        tokens = {
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
            access_token: process.env.GOOGLE_ACCESS_TOKEN || null,
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/drive.metadata.readonly'
        };
        console.log('✅ [Drive] Usando tokens via GOOGLE_REFRESH_TOKEN.');
    } else if (fs.existsSync(TOKEN_PATH)) {
        tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
        console.log('✅ [Drive] Usando arquivo tokens.json local.');
    } else {
        throw new Error('Credenciais do Google (tokens) não encontradas. Configure GOOGLE_TOKEN_JSON, GOOGLE_REFRESH_TOKEN ou forneça tokens.json.');
    }

    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
}

/**
 * Lista IDs de produtos existentes em uma pasta do Drive
 * @param {string} folderId 
 * @returns {Promise<Array<{id: string, fileId: string, name: string, driveUrl: string, isFavorito: boolean}>>}
 */
async function getExistingIdsFromDrive(folderId) {
    if (!folderId) {
        console.log('⚠️ [Drive] ID da pasta não fornecido. Pulando verificação do Drive.');
        return [];
    }

    try {
        const auth = loadAuth();
        const drive = google.drive({ version: 'v3', auth });

        console.log(`📂 [Drive] Buscando arquivos na pasta: ${folderId}`);

        let items = [];
        let pageToken = null;
        let fileCount = 0;

        do {
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name)',
                spaces: 'drive',
                pageToken: pageToken,
                pageSize: 1000
            });

            const files = res.data.files;
            console.log(`📄 [Drive] Página processada. Arquivos encontrados: ${files ? files.length : 0}. Próxima página: ${res.data.nextPageToken ? 'SIM' : 'NÃO'}`);

            if (files && files.length > 0) {
                files.forEach(file => {
                    fileCount++;
                    // Regra: "o nome do arquivo é o codigo da roupa e o nome da loja"
                    // Extrai sequência de 6+ dígitos
                    const match = file.name.match(/(\d{6,})/);
                    if (match) {
                        const id = match[1];
                        const nameLower = file.name.toLowerCase();
                        const isFavorito = nameLower.includes('favorito');

                        // 🏪 DETECÇÃO DE LOJA pelo nome do arquivo
                        let store = null;
                        if (nameLower.includes('farm')) {
                            store = 'farm';
                        } else if (nameLower.includes('dress to') || nameLower.includes('dressto') || nameLower.includes('dress')) {
                            store = 'dressto';
                        } else if (nameLower.includes('kju')) {
                            store = 'kju';
                        } else if (nameLower.includes('zzmall') || nameLower.includes('zz mall')) {
                            store = 'zzmall';
                        } else if (nameLower.includes('live')) {
                            store = 'live';
                        }

                        if (store) {
                            items.push({
                                id: id,
                                fileId: file.id,
                                name: file.name,
                                driveUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
                                isFavorito: isFavorito,
                                store: store
                            });
                        } else {
                            // Opcional: Logar arquivos ignorados para debug
                            // console.log(`⚠️ [Drive] Arquivo sem loja identificada: ${file.name}`);
                        }
                    }
                });
            }
            pageToken = res.data.nextPageToken;
        } while (pageToken);

        console.log(`✅ [Drive] Total de arquivos da pasta: ${fileCount}`);
        console.log(`✅ [Drive] Itens válidos com ID e Loja: ${items.length}`);

        return items;

    } catch (error) {
        console.error('❌ [Drive] Erro ao listar arquivos:', error.message);
        return [];
    }
}

module.exports = { getExistingIdsFromDrive };
