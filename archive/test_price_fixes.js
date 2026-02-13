
const { initBrowser } = require('./browser_setup');
const { parseProductKJU } = require('./scrapers/kju/index');
const { parseProductZZMall } = require('./scrapers/zzmall/index');
const { parseProductDressTo } = require('./scrapers/dressto/index');

(async () => {
    console.log("🚀 INICIANDO TESTE DE PREÇOS ALVO 🚀");
    const { browser, page } = await initBrowser();

    try {
        // 1. KJU
        const kjuUrl = "https://www.kjubrasil.com/bolsinha-farm-me-leva-urbano-beija-flor-farm-etc-alto-verao-2026/";
        console.log(`\n💎 Testando KJU: ${kjuUrl}`);
        const kjuData = await parseProductKJU(page, kjuUrl);
        console.log("Resultado KJU:", kjuData ? `R$ ${kjuData.precoAtual} (Orig: ${kjuData.precoOriginal})` : "FALHA");

        // 2. ZZMALL
        const zzUrl = "https://www.zzmall.com.br/bolsa-shopping-branca-croche-lena-grande/p/Z1952354900001U";
        console.log(`\n🟠 Testando ZZMall: ${zzUrl}`);
        const zzData = await parseProductZZMall(page, zzUrl);
        console.log("Resultado ZZMall:", zzData ? `R$ ${zzData.precoAtual}` : "FALHA");

        // 3. DRESSTO
        const dressUrl = "https://www.dressto.com.br/vestido-longo-lurex-bordado-moedinha-01332387-2353/p";
        console.log(`\n👗 Testando Dress To: ${dressUrl}`);
        const dressData = await parseProductDressTo(page, dressUrl);
        console.log("Resultado Dress To:", dressData ? `Atual: R$ ${dressData.precoAtual} | Orig: R$ ${dressData.precoOriginal}` : "FALHA");

    } catch (err) {
        console.error("Erro fatal no teste:", err);
    } finally {
        await browser.close();
        console.log("\n🏁 Teste Finalizado");
    }
})();
