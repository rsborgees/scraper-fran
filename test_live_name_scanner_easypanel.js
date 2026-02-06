const { initBrowser } = require('./browser_setup');
const { getExistingIdsFromDrive } = require('./driveManager');

/**
 * Teste de diagnóstico específico para Live Name Scanner no Easypanel
 * Testa a funcionalidade de busca por nome que é usada para itens do Drive
 */
async function testLiveNameScanner() {
    console.log('🧪 TESTE: Live Name Scanner (Drive Items)\n');
    console.log('📊 Ambiente:');
    console.log(`   Platform: ${process.platform}`);
    console.log(`   HEADLESS: ${process.env.HEADLESS}`);
    console.log(`   Node: ${process.version}\n`);

    // Pega itens Live do Drive
    console.log('📂 Buscando itens Live no Google Drive...');
    const allItems = await getExistingIdsFromDrive(process.env.GOOGLE_DRIVE_FOLDER_ID);
    const liveItems = allItems.filter(i => i.store === 'live' && i.searchByName);

    console.log(`✅ Encontrados ${liveItems.length} itens Live para busca por nome:`);
    liveItems.forEach((item, i) => {
        console.log(`   ${i + 1}. "${item.name}" (${item.isFavorito ? '⭐ Favorito' : 'Regular'})`);
    });

    if (liveItems.length === 0) {
        console.log('\n❌ Nenhum item Live encontrado no Drive. Verifique GOOGLE_DRIVE_FOLDER_ID.');
        process.exit(1);
    }

    const { browser, context, page } = await initBrowser();

    try {
        // Testar com o primeiro item
        const testItem = liveItems[0];
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TESTANDO: "${testItem.name}"`);
        console.log('='.repeat(60));

        // TESTE 1: Navegação para home
        console.log('\n📍 TESTE 1: Navegação para home');
        const response = await page.goto('https://www.liveoficial.com.br', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForTimeout(3000);

        const homeTitle = await page.title();
        const homeStatus = response?.status() || 'N/A';

        console.log(`   ✅ Página carregada: ${page.url()}`);
        console.log(`   📊 Status HTTP: ${homeStatus}`);
        console.log(`   📝 Título: "${homeTitle}"`);

        if (homeStatus === 403 || homeTitle.includes('403') || homeTitle.includes('Forbidden')) {
            console.log('   ❌ HOME BLOQUEADA (403)');
        }

        // TESTE 2: Fechamento de popups
        console.log('\n🛡️ TESTE 2: Fechamento de popups');
        const popupsClosed = await page.evaluate(() => {
            const selectors = [
                'button.sc-f0c9328e-3',
                'button[class*="close"]',
                '.modal-close',
                '[aria-label="Close"]'
            ];

            let closed = 0;
            selectors.forEach(sel => {
                const els = document.querySelectorAll(sel);
                els.forEach(el => {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                        el.click();
                        closed++;
                    }
                });
            });
            return closed;
        });
        console.log(`   ✅ Popups fechados: ${popupsClosed}`);
        await page.waitForTimeout(1000);

        // TESTE 3: Localização do campo de busca
        console.log('\n🔍 TESTE 3: Localização do campo de busca');
        const searchInputSelector = 'input.bn-search__input, .search-input, input[type="search"]';

        const searchFieldInfo = await page.evaluate((selector) => {
            const input = document.querySelector(selector);
            if (!input) return { found: false };

            const style = window.getComputedStyle(input);
            return {
                found: true,
                visible: input.offsetWidth > 0 && input.offsetHeight > 0,
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                disabled: input.disabled,
                readonly: input.readOnly,
                placeholder: input.placeholder
            };
        }, searchInputSelector);

        console.log(`   Campo encontrado: ${searchFieldInfo.found ? '✅' : '❌'}`);
        if (searchFieldInfo.found) {
            console.log(`   Visível: ${searchFieldInfo.visible ? '✅' : '❌'}`);
            console.log(`   Display: ${searchFieldInfo.display}`);
            console.log(`   Visibility: ${searchFieldInfo.visibility}`);
            console.log(`   Opacity: ${searchFieldInfo.opacity}`);
            console.log(`   Disabled: ${searchFieldInfo.disabled}`);
            console.log(`   Placeholder: "${searchFieldInfo.placeholder}"`);
        }

        if (!searchFieldInfo.found || !searchFieldInfo.visible) {
            console.log('\n   ⚠️ Campo de busca não visível. Tentando abrir...');

            const searchIcon = page.locator('.bn-search__icon, button[aria-label*="Buscar"], .search-icon').first();
            const iconVisible = await searchIcon.isVisible({ timeout: 2000 }).catch(() => false);

            if (iconVisible) {
                await searchIcon.click();
                await page.waitForTimeout(1000);
                console.log('   ✅ Ícone de busca clicado');

                // Verificar novamente
                const nowVisible = await page.locator(searchInputSelector).first().isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`   Campo agora visível: ${nowVisible ? '✅' : '❌'}`);
            } else {
                console.log('   ❌ Ícone de busca não encontrado');
            }
        }

        // TESTE 4: Preenchimento e submissão
        console.log('\n✍️ TESTE 4: Preenchimento e submissão da busca');
        const searchQuery = testItem.name;
        console.log(`   Query: "${searchQuery}"`);

        try {
            const searchInput = page.locator(searchInputSelector).first();
            await searchInput.click({ timeout: 5000 });
            await page.waitForTimeout(500);
            await searchInput.fill('');
            await searchInput.type(searchQuery, { delay: 30 });
            await page.waitForTimeout(500);

            const inputValue = await searchInput.inputValue();
            console.log(`   ✅ Valor preenchido: "${inputValue}"`);

            await page.keyboard.press('Enter');
            console.log('   ✅ Enter pressionado');

            await page.waitForTimeout(10000); // Esperar resultados
            console.log(`   ✅ Aguardou 10s para resultados`);
            console.log(`   URL atual: ${page.url()}`);

        } catch (fillError) {
            console.log(`   ❌ Erro ao preencher campo: ${fillError.message}`);

            // Fallback: URL direta
            console.log('\n   🔄 Tentando fallback com URL direta...');
            const searchResponse = await page.goto(`https://www.liveoficial.com.br/busca?pesquisa=${encodeURIComponent(searchQuery)}`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await page.waitForTimeout(8000);
            console.log(`   ✅ Navegou via URL direta: ${page.url()}`);
            console.log(`   📊 Status HTTP Busca: ${searchResponse?.status() || 'N/A'}`);
        }

        // TESTE 5: Extração de resultados
        console.log('\n📊 TESTE 5: Extração de resultados');

        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                bodyLength: document.body.innerText.length,
                htmlSnippet: document.body.innerHTML.substring(0, 1000).replace(/\s+/g, ' '),
                hasH1: !!document.querySelector('h1'),
                h1Text: document.querySelector('h1')?.innerText || 'N/A'
            };
        });

        console.log(`   Título da página: "${pageInfo.title}"`);
        console.log(`   URL final: ${pageInfo.url}`);
        console.log(`   Tamanho do texto: ${pageInfo.bodyLength} caracteres`);
        console.log(`   H1: "${pageInfo.h1Text}"`);
        console.log(`   Snippet HTML: ${pageInfo.htmlSnippet.substring(0, 300)}...`);

        if (pageInfo.title.includes('Access Denied') || pageInfo.title.includes('Attention Required') || pageInfo.title.includes('Cloudflare')) {
            console.log('\n❌ BLOQUEIO DETECTADO: O servidor está sendo bloqueado pelo site da Live.');
        }

        // Scroll para carregar produtos
        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                window.scrollBy(0, 500);
                await new Promise(r => setTimeout(r, 1000));
            }
        });

        const results = await page.evaluate((query) => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const productLinks = links.filter(a => {
                const href = a.href.toLowerCase();
                return (href.includes('/p') || href.includes('/p/')) &&
                    !['/carrinho', '/login', '/checkout', '/conta'].some(s => href.includes(s));
            });

            return productLinks.map(a => {
                const text = (a.innerText || '').toLowerCase().trim();
                const target = query.toLowerCase().trim();
                let score = 0;

                const cleanText = text.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
                const cleanTarget = target.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

                if (cleanText === cleanTarget) score += 100;
                else if (cleanText.includes(cleanTarget) || cleanTarget.includes(cleanText)) score += 50;

                const targetWords = cleanTarget.split(' ').filter(w => w.length > 2);
                targetWords.forEach(w => { if (cleanText.includes(w)) score += 20; });

                return { url: a.href, score, text: text.substring(0, 100) };
            }).sort((a, b) => b.score - a.score);
        }, searchQuery);

        console.log(`   Total de produtos encontrados: ${results.length}`);
        console.log(`\n   Top 5 resultados:`);
        results.slice(0, 5).forEach((r, i) => {
            console.log(`      ${i + 1}. Score: ${r.score} | "${r.text}"`);
            console.log(`         URL: ${r.url}`);
        });

        if (results.length === 0) {
            console.log('\n   ❌ PROBLEMA: Nenhum produto encontrado!');
            await page.screenshot({ path: './debug/live_name_search_no_results.png' });
            console.log('   📸 Screenshot salvo: debug/live_name_search_no_results.png');

            const html = await page.content();
            const fs = require('fs');
            const path = require('path');
            fs.writeFileSync(path.join(__dirname, 'debug', 'live_name_search_no_results.html'), html);
            console.log('   📄 HTML salvo: debug/live_name_search_no_results.html');
        } else if (results[0].score < 60) {
            console.log(`\n   ⚠️ AVISO: Melhor match tem score baixo (${results[0].score})`);
            console.log('   Pode não ser o produto correto.');
        } else {
            console.log(`\n   ✅ SUCESSO: Melhor match com score ${results[0].score}`);
        }

        // TESTE 6: Parse do produto
        if (results.length > 0 && results[0].score > 20) {
            console.log('\n🔍 TESTE 6: Parse do produto');
            const { parseProductLive } = require('./scrapers/live');

            const productUrl = results[0].url;
            console.log(`   Navegando para: ${productUrl}`);

            const productData = await parseProductLive(page, productUrl);

            if (productData) {
                console.log(`   ✅ Produto parseado com sucesso:`);
                console.log(`      ID: ${productData.id}`);
                console.log(`      Nome: ${productData.nome}`);
                console.log(`      Preço: R$ ${productData.preco}`);
                console.log(`      Tamanhos: ${productData.tamanhos?.join(', ') || 'N/A'}`);
            } else {
                console.log(`   ❌ Falha ao parsear produto`);
            }
        }

    } catch (error) {
        console.error(`\n❌ ERRO CRÍTICO: ${error.message}`);
        console.error(error.stack);
    } finally {
        await browser.close();
        console.log('\n🔒 Navegador fechado.');
    }
}

testLiveNameScanner().then(() => {
    console.log('\n✅ Teste concluído.');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Teste falhou:', err);
    process.exit(1);
});
