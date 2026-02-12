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
async function getExistingIdsFromDrive(folderId, defaultStore = null) {
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
                fields: 'nextPageToken, files(id, name, createdTime)',
                spaces: 'drive',
                pageToken: pageToken,
                pageSize: 1000
            });

            const files = res.data.files;
            console.log(`📄 [Drive] Página processada. Arquivos encontrados: ${files ? files.length : 0}. Próxima página: ${res.data.nextPageToken ? 'SIM' : 'NÃO'}`);

            if (files && files.length > 0) {
                files.forEach(file => {
                    fileCount++;
                    const nameLower = file.name.toLowerCase();
                    const createdTime = file.createdTime;

                    // Regra: "o nome do arquivo é o codigo da roupa e o nome da loja"
                    // Conjunto: IDs separados por ESPAÇO. Ex: "351693 350740"
                    // NÃO é conjunto se houver underline: "351693_350740" -> Ignora underline

                    // Busca IDs preservando padrões de conjunto ou cor
                    // 1. Tenta capturar padrões compostos primeiro (XXXXXX_YYYY ou XXXXXX-YYYY)
                    const compositeMatches = file.name.match(/\d{6,}[_-]\d+/g) || [];

                    // 2. Tenta capturar IDs simples (mínimo 6 dígitos)
                    // Filtra para não pegar partes de IDs compostos já capturados
                    const simpleMatches = (file.name.match(/\d{6,}/g) || []).filter(sid => {
                        return !compositeMatches.some(cid => cid.includes(sid));
                    });

                    let ids = [...compositeMatches, ...simpleMatches];
                    // Normaliza hífens para underscores em todos os IDs capturados
                    ids = ids.map(id => id.replace(/-/g, '_'));

                    if (ids.length > 0) {
                        const verbatimId = ids.join(' ');
                        const mainId = ids[0];
                        const isFavorito = nameLower.includes('favorito');
                        const isNovidade = nameLower.includes('novidade');
                        const isBazar = nameLower.includes('bazar');
                        const isBazarFavorito = isBazar && isFavorito;

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

                        if (!store && defaultStore) {
                            store = defaultStore;
                        }

                        if (store) {
                            items.push({
                                id: mainId,
                                driveId: verbatimId, // Preserve verbatim ID string
                                ids: ids, // Novo campo com todos os IDs
                                isSet: ids.length > 1,
                                fileId: file.id,
                                name: file.name,
                                driveUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
                                isFavorito: isFavorito,
                                novidade: isNovidade,
                                bazar: isBazar,
                                bazarFavorito: isBazarFavorito,
                                store: store,
                                createdTime: createdTime
                            });
                        }
                    } else if (nameLower.includes('live')) {
                        // 🆕 FEATURE: Live Items by Name (No ID in filename)
                        const isFavorito = nameLower.includes('favorito');
                        const isNovidade = nameLower.includes('novidade');
                        const isBazar = nameLower.includes('bazar');
                        const isBazarFavorito = isBazar && isFavorito;

                        // Clean name for search
                        let cleanName = file.name.toLowerCase()
                            .replace(/\.jpg|\.png|\.jpeg|\.webp/g, '')
                            .replace(/favorito/g, '')
                            .replace(/unavailable/g, '')
                            .trim();

                        // Remove 'live' only if it's at the end
                        cleanName = cleanName.replace(/\s+live$/i, '').trim();

                        // Normalize spaces
                        cleanName = cleanName.replace(/\s+/g, ' ');

                        if (cleanName.length > 3) {
                            items.push({
                                id: `LIVE_${file.id.substring(0, 6)}`, // Temporary ID
                                driveId: cleanName, // For Live by name, cleanName is the reference
                                ids: [],
                                isSet: false,
                                fileId: file.id,
                                name: cleanName, // This will be the search query
                                originalName: file.name,
                                driveUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
                                isFavorito: isFavorito,
                                novidade: isNovidade,
                                bazar: isBazar,
                                bazarFavorito: isBazarFavorito,
                                store: 'live',
                                searchByName: true, // Flag to trigger name search
                                createdTime: createdTime
                            });
                            console.log(`   ✨ [Drive] Item Live detectado por nome: "${cleanName}"`);
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


/**
 * Busca um arquivo específico pelo ID do produto (string contida no nome)
 * Mais eficiente que listar tudo.
 * @param {string} folderId 
 * @param {string} productId 
 */
async function findFileByProductId(folderId, productId) {
    if (!folderId || !productId) return null;

    try {
        const auth = loadAuth();
        const drive = google.drive({ version: 'v3', auth });

        // Tenta buscar pelo ID exato e também pela versão normalizada
        const normId = productId.toString().replace(/\D/g, '');
        const query = `'${folderId}' in parents and (name contains '${productId}' or name contains '${normId}') and trashed = false`;

        const start = Date.now();
        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name, webContentLink)',
            spaces: 'drive'
        });

        const files = res.data.files;
        if (files && files.length > 0) {
            // Pega o primeiro match
            const file = files[0];
            console.log(`✅ [Drive] Arquivo encontrado para ${productId}: ${file.name} (${Date.now() - start}ms)`);

            // Link direto para download
            const driveUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

            return {
                id: productId,
                fileId: file.id,
                name: file.name,
                driveUrl: driveUrl
            };
        }

        return null;

    } catch (error) {
        console.error(`❌ [Drive] Erro ao buscar arquivo ${productId}:`, error.message);
        return null;
    }
}

module.exports = { getExistingIdsFromDrive, findFileByProductId };
