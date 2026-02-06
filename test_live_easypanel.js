const { initBrowser } = require('./browser_setup');
const { scrapeLive } = require('./scrapers/live');

/**
 * Teste de diagnóstico completo para Live scraper no Easypanel
 * Verifica cada etapa do processo de scraping
 */
async function testLiveEasypanel() {
    console.log('🧪 TESTE DE DIAGNÓSTICO: Live Scraper no Easypanel\n');
    console.log('📊 Ambiente:');
    console.log(`   Platform: ${process.platform}`);
    console.log(`   HEADLESS: ${process.env.HEADLESS}`);
    console.log(`   Node: ${process.version}\n`);

    const { browser, context, page } = await initBrowser();

    try {
        // TESTE 1: Navegação para a página de outlet
        console.log('='.repeat(60));
        console.log('TESTE 1: Navegação para página de outlet');
        console.log('='.repeat(60));

        const targetUrl = 'https://www.liveoficial.com.br/outlet';
        console.log(`🔗 Navegando para: ${targetUrl}`);

        await page.goto(targetUrl, {
            waitUntil: 'load',
            timeout: 60000
        });

        await page.waitForTimeout(5000);

        const pageTitle = await page.title();
        console.log(`✅ Página carregada: ${pageTitle}`);
        console.log(`   URL atual: ${page.url()}\n`);

        // TESTE 2: Detecção de popups
        console.log('='.repeat(60));
        console.log('TESTE 2: Verificação de popups/modais');
        console.log('='.repeat(60));

        const popupInfo = await page.evaluate(() => {
            const closeSelectors = [
                'button.sc-f0c9328e-3.dnwgCm',
                'button[class*="close"]',
                '.modal-close',
                'button:has(svg)',
                '[aria-label="Close"]'
            ];

            const found = [];
            closeSelectors.forEach(sel => {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    found.push({ selector: sel, count: els.length });
                }
            });

            return found;
        });

        console.log(`   Popups encontrados: ${popupInfo.length > 0 ? JSON.stringify(popupInfo, null, 2) : 'Nenhum'}\n`);

        // TESTE 3: Extração de URLs de produtos
        console.log('='.repeat(60));
        console.log('TESTE 3: Extração de URLs de produtos');
        console.log('='.repeat(60));

        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                window.scrollBy(0, 800);
                await new Promise(r => setTimeout(r, 1000));
            }
        });

        const productUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            const allUrls = [...new Set(links.map(a => a.href))];

            const productUrls = allUrls.filter(url => {
                try {
                    const parsed = new URL(url);
                    if (parsed.hostname !== window.location.hostname && !url.startsWith('/')) return false;
                    const path = parsed.pathname;
                    const isProductPattern = (path.endsWith('/p') || path.includes('/p/')) && path.length > 10;
                    const isExcluded = path.includes('/carrinho') || path.includes('/login') || path === '/produtos/p';
                    return isProductPattern && !isExcluded;
                } catch (e) {
                    return false;
                }
            });

            return {
                totalLinks: links.length,
                uniqueUrls: allUrls.length,
                productUrls: productUrls.slice(0, 5), // Primeiros 5 para teste
                productCount: productUrls.length
            };
        });

        console.log(`   Total de links: ${productUrls.totalLinks}`);
        console.log(`   URLs únicas: ${productUrls.uniqueUrls}`);
        console.log(`   URLs de produtos encontradas: ${productUrls.productCount}`);
        console.log(`   Primeiras 5 URLs:`);
        productUrls.productUrls.forEach((url, i) => {
            console.log(`      ${i + 1}. ${url}`);
        });
        console.log();

        if (productUrls.productCount === 0) {
            console.log('❌ PROBLEMA IDENTIFICADO: Nenhuma URL de produto encontrada!');
            console.log('   Possíveis causas:');
            console.log('   - Página não carregou completamente');
            console.log('   - Estrutura HTML diferente no servidor');
            console.log('   - Bloqueio por anti-bot\n');

            // Salvar screenshot para análise
            await page.screenshot({ path: './debug/live_easypanel_no_products.png' });
            console.log('   📸 Screenshot salvo: debug/live_easypanel_no_products.png\n');

            // Dump HTML para análise
            const html = await page.content();
            const fs = require('fs');
            const path = require('path');
            const debugDir = path.join(__dirname, 'debug');
            if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
            fs.writeFileSync(path.join(debugDir, 'live_easypanel_outlet.html'), html);
            console.log('   📄 HTML salvo: debug/live_easypanel_outlet.html\n');
        }

        // TESTE 4: Parse de um produto específico
        if (productUrls.productCount > 0) {
            console.log('='.repeat(60));
            console.log('TESTE 4: Parse de produto individual');
            console.log('='.repeat(60));

            const testUrl = productUrls.productUrls[0];
            console.log(`🔗 Testando produto: ${testUrl}`);

            await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForTimeout(5000);

            const productData = await page.evaluate(() => {
                const getSafeText = (el) => {
                    if (!el) return '';
                    return el.innerText ? el.innerText.trim() : el.textContent ? el.textContent.trim() : '';
                };

                // Nome
                let nome = '';
                const nameSelectors = [
                    'h1.vtex-store-components-3-x-productBrand',
                    'h1[class*="productName"]',
                    'h1[class*="productBrand"]',
                    'h1'
                ];

                for (const selector of nameSelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        nome = getSafeText(el);
                        if (nome && nome.length > 3) break;
                    }
                }

                // Preço via JSON-LD
                let precoJsonLd = 0;
                const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                for (const script of jsonLdScripts) {
                    try {
                        const data = JSON.parse(script.innerHTML);
                        const products = Array.isArray(data) ? data : [data];
                        const product = products.find(item => item['@type'] === 'Product' || (typeof item['@type'] === 'string' && item['@type'].includes('Product')));

                        if (product && product.offers) {
                            const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
                            const validOffers = offers.filter(o => o.price && parseFloat(o.price) > 0);
                            if (validOffers.length > 0) {
                                precoJsonLd = parseFloat(validOffers[0].price);
                                break;
                            }
                        }
                    } catch (e) { }
                }

                // Preço via Meta
                let precoMeta = 0;
                const metaPrice = document.querySelector('meta[property="product:price:amount"]');
                if (metaPrice && metaPrice.content) {
                    precoMeta = parseFloat(metaPrice.content);
                }

                // Preço via DOM
                let precoDOM = 0;
                const priceSelectors = [
                    '.vtex-product-price-1-x-sellingPrice .vtex-product-price-1-x-sellingPriceValue',
                    '[class*="sellingPriceValue"]',
                    '.sc-79aad9d-3'
                ];

                for (const selector of priceSelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        const text = getSafeText(el);
                        const parsed = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
                        if (!isNaN(parsed) && parsed > 0) {
                            precoDOM = parsed;
                            break;
                        }
                    }
                }

                // Tamanhos
                const tamanhos = [];
                const sizeElements = document.querySelectorAll('.vtex-store-components-3-x-skuSelectorItem, [class*="sku-selector"] button');
                sizeElements.forEach(el => {
                    let txt = getSafeText(el).toUpperCase();
                    txt = txt.replace(/TAMANHO|TAM|SIZE|[:\n]/g, '').trim();
                    const match = txt.match(/^(PP|P|M|G|GG|UN|ÚNICO|3[4-9]|4[0-6])$/i);
                    if (match) {
                        const isDisabled = el.disabled || el.classList.contains('disabled') || el.classList.contains('unavailable');
                        if (!isDisabled && el.offsetWidth > 0 && el.offsetHeight > 0) {
                            tamanhos.push(match[0].toUpperCase());
                        }
                    }
                });

                return {
                    nome,
                    precoJsonLd,
                    precoMeta,
                    precoDOM,
                    tamanhos: [...new Set(tamanhos)],
                    url: window.location.href
                };
            });

            console.log(`   Nome: ${productData.nome || '❌ NÃO ENCONTRADO'}`);
            console.log(`   Preço (JSON-LD): ${productData.precoJsonLd || '❌ NÃO ENCONTRADO'}`);
            console.log(`   Preço (Meta): ${productData.precoMeta || '❌ NÃO ENCONTRADO'}`);
            console.log(`   Preço (DOM): ${productData.precoDOM || '❌ NÃO ENCONTRADO'}`);
            console.log(`   Tamanhos: ${productData.tamanhos.length > 0 ? productData.tamanhos.join(', ') : '❌ NÃO ENCONTRADO'}`);
            console.log();

            if (!productData.nome || (productData.precoJsonLd === 0 && productData.precoMeta === 0 && productData.precoDOM === 0)) {
                console.log('❌ PROBLEMA IDENTIFICADO: Falha na extração de dados do produto!');
                await page.screenshot({ path: './debug/live_easypanel_product_fail.png' });
                console.log('   📸 Screenshot salvo: debug/live_easypanel_product_fail.png\n');
            }
        }

        // TESTE 5: Executar scraper completo
        console.log('='.repeat(60));
        console.log('TESTE 5: Execução do scraper completo');
        console.log('='.repeat(60));

        console.log('🚀 Executando scrapeLive(quota=2)...\n');
        const products = await scrapeLive(2, false, browser);

        console.log(`\n✅ Scraper retornou ${products.length} produtos:`);
        products.forEach((p, i) => {
            console.log(`\n   Produto ${i + 1}:`);
            console.log(`      ID: ${p.id}`);
            console.log(`      Nome: ${p.nome}`);
            console.log(`      Preço: R$ ${p.preco}`);
            console.log(`      Tamanhos: ${p.tamanhos?.join(', ') || 'N/A'}`);
            console.log(`      URL: ${p.url}`);
        });

        if (products.length === 0) {
            console.log('\n❌ PROBLEMA CONFIRMADO: Scraper não retornou produtos!');
            console.log('   Revise os logs acima para identificar onde falhou.');
        } else {
            console.log('\n✅ SUCESSO: Scraper funcionando corretamente!');
        }

    } catch (error) {
        console.error(`\n❌ ERRO CRÍTICO: ${error.message}`);
        console.error(error.stack);
    } finally {
        await browser.close();
        console.log('\n🔒 Navegador fechado.');
    }
}

testLiveEasypanel().then(() => {
    console.log('\n✅ Teste concluído.');
    process.exit(0);
}).catch(err => {
    console.error('\n❌ Teste falhou:', err);
    process.exit(1);
});
