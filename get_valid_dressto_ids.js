const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testApi() {
    const url = 'https://www.dressto.com.br/api/catalog_system/pub/products/search?sc=1&_from=0&_to=5';
    try {
        const resp = await fetch(url);
        if (resp.ok) {
            const json = await resp.json();
            json.forEach(p => {
                console.log(`Product: ${p.productName} | ID: ${p.productReference} | Slug: ${p.linkText}`);
            });
        }
    } catch (err) { }
}

testApi();
