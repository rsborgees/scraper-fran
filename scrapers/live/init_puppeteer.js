const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

async function initPuppeteer() {
    const isLinux = process.platform === 'linux';
    const envHeadless = process.env.HEADLESS !== 'false';
    const isHeadless = isLinux ? true : envHeadless;

    const mode = isHeadless ? 'HEADLESS (Server Safe)' : 'VISUAL';
    console.log(`🚀 Iniciando Puppeteer-extra (MODO ${mode}) com Stealth Plugin...`);

    const proxyServer = process.env.LIVE_PROXY_SERVER || process.env.PROXY_SERVER;
    const proxyUser = process.env.LIVE_PROXY_USERNAME || process.env.PROXY_USERNAME;
    const proxyPass = process.env.LIVE_PROXY_PASSWORD || process.env.PROXY_PASSWORD;

    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1366,768',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--start-maximized',
        '--ignore-certificate-errors',
        '--disable-web-security'
    ];

    if (proxyServer) {
        console.log(`🌐 Usando Proxy (${process.env.LIVE_PROXY_SERVER ? 'LIVE' : 'Global'}): ${proxyServer}`);
        args.push(`--proxy-server=${proxyServer}`);
    }

    const browser = await puppeteer.launch({
        headless: isHeadless ? 'new' : false, // Usando 'new' para o novo modo headless do Chrome (muito mais stealth)
        args: args,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        ignoreDefaultArgs: ['--enable-automation']
    });

    const page = await browser.newPage();

    if (proxyUser && proxyPass) {
        console.log(`🔐 Autenticando Proxy: ${proxyUser}`);
        await page.authenticate({
            username: proxyUser,
            password: proxyPass
        });
    }

    const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    await page.setUserAgent(randomUserAgent);
    console.log(`🕵️ User-Agent configurado: ${randomUserAgent}`);

    await page.setViewport({ width: 1366, height: 768 });

    // 🚫 BLOQUEIO DE IMAGENS: Economiza dados do proxy interceptando requests de mídia
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        const url = req.url();

        // Bloqueia imagens, fontes e mídia (maior consumo de dados)
        if (['image', 'media', 'font'].includes(resourceType)) {
            req.abort();
            return;
        }

        // Bloqueia domínios de tracking/analytics que não são necessários
        const blockedDomains = [
            'googletagmanager.com',
            'connect.facebook.net',
            'static.zdassets.com',
            'static.trustvox.com.br',
            'advcake.dataroyal.com.br',
            'c.usebeon.io',
            'search-api.production.usebeon.io',
            'sgtm.liveoficial.com.br',
            'vfr-v3-production.sizebay.technology',
        ];

        if (blockedDomains.some(domain => url.includes(domain))) {
            req.abort();
            return;
        }

        req.continue();
    });

    console.log('🚫 Bloqueio de imagens/tracking ativado (economia de proxy).');

    // Extra stealth tactics just in case (though StealthPlugin handles most of this)
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    return { browser, page };
}

module.exports = { initPuppeteer };
