const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const express = require('express');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const TOKEN_PATH = path.join(__dirname, 'tokens.json');
// IMPORTANTE: Esta URL deve ser EXATAMENTE a mesma no Google Cloud Console
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function authorize() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('❌ Erro: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET precisam estar no .env');
        process.exit(1);
    }

    const oAuth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        REDIRECT_URI
    );

    // Check if we have valid tokens
    if (fs.existsSync(TOKEN_PATH)) {
        console.log('✅ Tokens já existem em tokens.json');
        console.log('   Apague este arquivo se quiser logar novamente.');
        return;
    }

    await getAccessToken(oAuth2Client);
}

function getAccessToken(oAuth2Client) {
    const app = express();
    let server = null;

    // Rota de callback
    app.get('/oauth2callback', async (req, res) => {
        const code = req.query.code;
        if (code) {
            res.send('<h1>Autenticação realizada com sucesso!</h1><p>Você pode fechar esta aba e voltar ao terminal.</p>');
            try {
                console.log('🔄 Trocando código por token...');
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
                console.log('✅ Token armazenado com sucesso em', TOKEN_PATH);
            } catch (err) {
                console.error('❌ Erro ao recuperar access token:', err.message);
            } finally {
                if (server) server.close();
                process.exit(0);
            }
        } else {
            res.send('Nenhum código encontrado.');
        }
    });

    server = app.listen(3000, () => {
        // Gera a URL de autenticação
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        console.log('\n⚠️  AÇÃO NECESSÁRIA:');
        console.log('---------------------------------------------------------');
        console.log(`1. Tenha certeza que "${REDIRECT_URI}" está adicionado`);
        console.log('   em "Authorized redirect URIs" no Google Cloud Console.');
        console.log('---------------------------------------------------------');
        console.log('2. Clique ou copie este link para autorizar:');
        console.log(`\n👉  ${authUrl}  👈\n`);
        console.log('---------------------------------------------------------');
        console.log('O servidor está escutando na porta 3000...');
    });
}

authorize();
