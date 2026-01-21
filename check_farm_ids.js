const { initBrowser } = require('./browser_setup');

async function checkIds(ids) {
    const { browser, context } = await initBrowser();
    const page = await context.newPage();

    for (const id of ids) {
        try {
            console.log(`\n🔎 Verificando ID ${id}...`);
            const apiUrl = `https://www.farmrio.com.br/api/catalog_system/pub/products/search?ft=${id}`;
            const response = await page.goto(apiUrl);
            const data = await response.json();

            if (data && data.length > 0) {
                console.log(`   ✅ Encontrado: ${data[0].productName}`);
                // Check stock (simplificado: se tem link e preço na API, costuma estar ok)
                console.log(`   🔗 Link: ${data[0].link}`);
            } else {
                console.log(`   ❌ Não encontrado.`);
            }
        } catch (e) {
            console.log(`   ❌ Erro: ${e.message}`);
        }
    }

    await browser.close();
}

// Candidatos do Drive
const candidates = [
    '357978', '357979', // Farm Inverno Favorito
    '359800', '359799', // Farm Inverno
    '363115', '355024', // Farm Inverno Favorito
    '357264', '357266'  // Farm Inverno Favorito
];

checkIds(candidates);
