const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testApi() {
    const urls = [
        'https://www.dressto.com.br/api/catalog_system/pub/products/search?sc=1&_from=0&_to=19',
        'https://www.dressto.com.br/api/catalog_system/pub/products/search/02083385?sc=1',
        'https://www.dressto.com.br/api/catalog_system/pub/products/search?ft=vestido&sc=1'
    ];

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Cookie': 'vtex_segment=eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9'
    };

    for (const url of urls) {
        console.log(`\nTesting URL: ${url}`);
        try {
            const res = await fetch(url, { headers });
            console.log(`Status: ${res.status} ${res.statusText}`);
            if (res.ok) {
                const json = await res.json();
                console.log(`Items found: ${json.length}`);
                if (json.length > 0) {
                    console.log(`First item: ${json[0].productName} (${json[0].productReference})`);
                }
            } else {
                const text = await res.text();
                console.log(`Response: ${text.substring(0, 200)}`);
            }
        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }
}

testApi();
