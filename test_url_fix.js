const { appendQueryParams } = require('./urlUtils');
const SELLER_CODE = "7B1313";

function testFix(url) {
    // Simulating modified scrapers/farm/index.js logic (just passes the URL)
    let productUrl = url;
    console.log(`Step 1 (Scraper): ${productUrl}`);

    // Simulating messageBuilder.js logic
    const finalUrl = appendQueryParams(productUrl, {
        brand: 'farm',
        utm_campaign: SELLER_CODE,
        utm_source: 'vendedoras',
        utm_medium: 'organico'
    });
    console.log(`Step 2 (MessageBuilder): ${finalUrl}`);
    return finalUrl;
}

const urlWithParam = "https://www.farmrio.com.br/vestido-p?brand=farm";
const urlWithoutParam = "https://www.farmrio.com.br/vestido-p";

console.log("Testing URL with param:");
testFix(urlWithParam);

console.log("\nTesting URL without param:");
testFix(urlWithoutParam);
