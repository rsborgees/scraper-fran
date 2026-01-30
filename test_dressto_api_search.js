const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testApi(term) {
    const url = `https://www.dressto.com.br/api/catalog_system/pub/products/search?ft=${term}&sc=1`;
    console.log(`\nTesting API for "${term}": ${url}`);
    try {
        const resp = await fetch(url);
        const json = await resp.json();
        console.log(`Products found: ${json.length}`);
    } catch (err) { }
}

testApi('Macaquinho');
testApi('07010946');
