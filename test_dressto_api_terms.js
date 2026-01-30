const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testApi(term) {
    const url = `https://www.dressto.com.br/api/catalog_system/pub/products/search?ft=${term}&sc=1`;
    console.log(`\nTesting API for "${term}": ${url}`);
    try {
        const resp = await fetch(url);
        if (resp.ok) {
            const json = await resp.json();
            console.log(`Products found: ${json.length}`);
            if (json.length > 0) {
                console.log(`Found: ${json[0].productName} | Ref: ${json[0].productReference}`);
            }
        }
    } catch (err) { }
}

testApi('07.01.0946_2371');
testApi('07010946');
testApi('070109462371');
