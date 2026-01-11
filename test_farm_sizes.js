const { parseProduct } = require('./scrapers/farm/parser');

(async () => {
    const url = "https://www.farmrio.com.br/vestido-longo-estampado-flor-de-praia-flor-de-praia_amarelo-jasmim-351062-53944/p";
    console.log("Testing size parsing for URL:", url);
    // Since parseProduct doesn't return debug info directly in the main return, 
    // I need to intercept the log or modified the code to return it.
    // Actually, I modified parseProduct to print the product but let's see.
    // Wait, parseProduct returns the product object. I'll need to check if I can get debugInfo.

    // Actually, I'll modify parser.js briefly to return the whole result during this test?
    // No, I'll just check the console output if I added console.log.
    // I added console.log for debugInfo in parser.js:358.

    const product = await parseProduct(url);
    if (product) {
        console.log("Product found:", product.nome);
        console.log("Sizes found:", product.tamanhos);
    }
})();
