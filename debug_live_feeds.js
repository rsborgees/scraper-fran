const axios = require('axios');

async function checkFeeds() {
    console.log('🧪 VERIFICANDO FEEDS PUBLICOS (Bypass 403)...');

    const urls = [
        'https://www.liveoficial.com.br/sitemap.xml',
        'https://www.liveoficial.com.br/XMLData/googleshopping.xml',
        'https://www.liveoficial.com.br/googleshopping.xml',
        'https://www.liveoficial.com.br/feed/google-shopping.xml'
    ];

    for (const url of urls) {
        try {
            console.log(`\n🔗 Testando: ${url}`);
            const response = await axios.head(url, {
                headers: { 'User-Agent': 'Bot-Google' }, // Fingir ser Google Bot
                timeout: 5000,
                validateStatus: null
            });
            console.log(`   ✅ Status: ${response.status}`);
            if (response.status === 200) {
                console.log('   🎉 FEED ENCONTRADO!');
            }
        } catch (e) {
            console.log(`   ❌ Erro: ${e.message}`);
        }
    }
}

checkFeeds();
