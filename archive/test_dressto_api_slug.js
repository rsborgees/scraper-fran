const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testApi(slug) {
    const url = `https://www.dressto.com.br/api/catalog_system/pub/products/search/${slug}?sc=1`;
    console.log(`Testing Slug: ${url}`);
    try {
        const resp = await fetch(url);
        const json = await resp.json();
        console.log(`Found: ${json.length}`);
    } catch (err) { }
}

testApi('macaquinho-estampa-gotas-07010946-2371');
