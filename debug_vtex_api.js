// Use global fetch (available in Node 18+)

async function debugVtexApi() {
    const slug = 'macaquinho-estampa-gotas-07010946-2371';
    const apiUrl = `https://www.dressto.com.br/api/catalog_system/pub/products/search/${slug}?sc=1`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Cookie': 'vtex_segment=eyJjdXJyZW5jeUNvZGUiOiJCUkwiLCJjb3VudHJ5Q29kZSI6IkJSQSIsImxvY2FsZUNvZGUiOiJwdC1CUiJ9'
    };

    try {
        console.log(`Fetching: ${apiUrl}`);
        const resp = await fetch(apiUrl, { headers });
        if (resp.ok) {
            const json = await resp.json();
            if (json && json.length > 0) {
                const product = json[0];
                console.log(`Product: ${product.productName}`);
                if (product.items && product.items.length > 0) {
                    console.log('Sample item structure:', JSON.stringify(product.items[0], null, 2));
                }
                product.items.forEach(item => {
                    console.log(`\nItem: ${item.name} (${item.itemId})`);
                    if (item.sellers && item.sellers.length > 0) {
                        item.sellers.forEach(seller => {
                            const comm = seller.commertialOffer;
                            console.log(`  Seller: ${seller.sellerId} | AvailableQuantity: ${comm.AvailableQuantity} | Price: ${comm.Price}`);
                        });
                    } else {
                        console.log('  No sellers found.');
                    }
                });
            } else {
                console.log('No product found.');
            }
        } else {
            console.log(`Status: ${resp.status}`);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

debugVtexApi();
