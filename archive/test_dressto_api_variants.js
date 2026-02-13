const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testApi(id) {
    // Test alternative 1: Slug style (Current)
    const url1 = `https://www.dressto.com.br/api/catalog_system/pub/products/search/${id}?sc=1`;
    // Test alternative 2: ft param (Text search)
    const url2 = `https://www.dressto.com.br/api/catalog_system/pub/products/search?ft=${id}&sc=1`;

    for (const url of [url1, url2]) {
        console.log(`\nTesting API: ${url}`);
        try {
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            console.log(`Status: ${resp.status}`);
            if (resp.ok) {
                const json = await resp.json();
                console.log(`Products found: ${json.length}`);
                if (json.length > 0) {
                    console.log(`Example: ${json[0].productName} | Ref: ${json[0].productReference}`);
                }
            }
        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }
}

testApi('01332543'); // ID that failed in previous test
