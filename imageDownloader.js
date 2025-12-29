const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

/**
 * Downloads an image from a URL and saves it to the specified path.
 * @param {string} url 
 * @param {string} filepath 
 */
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to consume '${url}', status code: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(filepath));
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
}

/**
 * Extracts the product ID based on the store logic.
 * @param {import('playwright').Page} page 
 * @param {string} store 
 * @param {string} url
 */
async function extractProductId(page, store, url) {
    let id = 'unknown';

    try {
        if (store === 'FARM') {
            // FARM strategy: "ID exibido na página". Usually "Ref: 123456"
            // Selector might be .product-reference, or text search.
            const refText = await page.evaluate(() => {
                // Try specific FARM selectors (VTEX often)
                const el = document.querySelector('.vtex-product-identifier, .productReference, .ref');
                if (el) return el.innerText;

                // Search in body text for "Ref:"
                const body = document.body.innerText;
                const match = body.match(/Ref[:\.]?\s*(\d+)/i);
                return match ? match[1] : '';
            });

            // Try to find a sequence of numbers, take first 6? 
            // "quando houver números longos, usar somente os 6 primeiros dígitos"
            // Example: Ref: 12345678 -> 123456
            const match = refText.match(/(\d{5,})/);
            if (match) {
                id = match[1].substring(0, 6);
            }
        } else {
            // Default strategy: URL or Code
            const urlId = url.split('/').pop().split('?')[0].replace(/[^a-zA-Z0-9]/g, '');
            if (urlId.length > 0) id = urlId;

            // Try visible SKU/Ref if available
            const visibleRef = await page.evaluate(() => {
                const el = document.querySelector('.sku, .ref, .product-code');
                return el ? el.innerText.trim() : null;
            });
            if (visibleRef) id = visibleRef.replace(/[^a-zA-Z0-9]/g, '');
        }
    } catch (e) {
        console.warn(`ID Extraction failed: ${e.message}`);
    }

    return id;
}

/**
 * Main function to process a product URL.
 * @param {string} url 
 */
async function processProductUrl(url) {
    console.log(`\nProcessing: ${url}`);

    // Detect Store
    let store = 'GENERIC';
    if (url.includes('farmrio')) store = 'FARM';
    else if (url.includes('kju')) store = 'KJU';
    else if (url.includes('dressto')) store = 'DRESSTO';
    else if (url.includes('liveoficial')) store = 'LIVE';
    else if (url.includes('zzmall')) store = 'ZZMALL';

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    }); // Headless as requested
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'pt-BR'
    });
    const page = await context.newPage();

    const result = {
        path: [],
        id: null,
        store: store,
        status: 'error',
        reason: ''
    };

    try {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });

        // Wait for images - Improved
        try {
            await page.waitForSelector('img', { timeout: 10000 });
            // Scroll to bottom to trigger lazy loading
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
            await page.waitForTimeout(1000);
        } catch (e) {
            console.log('Timeout waiting for images, proceeding anyway...');
        }

        // Extract ID
        const id = await extractProductId(page, store, url);
        result.id = id;

        // Find Images
        const imageUrls = await page.evaluate(() => {
            console.log(`Page Title: ${document.title}`);
            const allImgs = Array.from(document.querySelectorAll('img'));

            // Debug: return some info about first 5 image
            const debugInfo = allImgs.slice(0, 5).map(img => ({
                src: img.src,
                w: img.width,
                h: img.height,
                visible: img.offsetParent !== null
            }));

            // Specific Selectors for common Platforms (VTEX, Shopify)
            const gallerySelectors = [
                '.product-image',
                '.vtex-store-components-3-x-productImageTag',
                '.swiper-slide-active img',
                '.image-gallery img',
                'img[data-zoom]'
            ];

            let candidates = [];

            // Try specific selectors first
            for (const sel of gallerySelectors) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    candidates.push(...Array.from(els));
                }
            }

            // Fallback to all large images
            if (candidates.length === 0) {
                const allImages = Array.from(document.querySelectorAll('img'));
                candidates = allImages.filter(img => {
                    const r = img.getBoundingClientRect();
                    return r.width > 250 && r.height > 250;
                });
            }

            // Fallback to og:image if nothing found
            if (candidates.length === 0) {
                const ogImg = document.querySelector('meta[property="og:image"]');
                if (ogImg && ogImg.content) {
                    return { debug: debugInfo, urls: [ogImg.content] };
                }
            }

            // Filter bad srcs
            const finalUrls = candidates
                .map(img => img.currentSrc || img.src)
                .filter(src => src && !src.includes('svg') && !src.includes('data:image'))
                .slice(0, 1);

            if (finalUrls.length === 0) {
                const ogImg = document.querySelector('meta[property="og:image"]');
                if (ogImg && ogImg.content) {
                    return { debug: debugInfo, urls: [ogImg.content] };
                }
            }

            return {
                debug: debugInfo,
                urls: finalUrls
            };
        });

        console.log(`Page Title: ${await page.title()}`);
        console.log('Debug Images:', JSON.stringify(imageUrls.debug, null, 2));
        console.log(`Found ${imageUrls.urls.length} candidate images.`);

        if (imageUrls.urls.length === 0) {
            throw new Error('No suitable images found');
        }

        // Download
        let count = 0;
        for (const imgUrl of imageUrls.urls) {
            const filename = `${store}_${id}.jpg`;
            const filepath = path.join(DOWNLOAD_DIR, filename);
            const finalUrl = new URL(imgUrl, url).toString();

            try {
                await downloadImage(finalUrl, filepath);
                result.path.push(filepath);
                console.log(`Downloaded: ${filename}`);
            } catch (err) {
                console.error(`Download failed for ${finalUrl}: ${err.message}`);
            }
            break; // <-- garante que baixa só UMA
        }


        if (result.path.length > 0) {
            result.status = 'success';
        } else {
            result.reason = 'All downloads failed';
        }

    } catch (error) {
        result.reason = error.message;
        console.error(`Error processing ${url}:`, error);
    } finally {
        await browser.close();
    }

    return result;
}

// Example usage if run directly
if (require.main === module) {
    const testUrl = process.argv[2];
    if (testUrl) {
        processProductUrl(testUrl).then(console.log);
    } else {
        console.log("Usage: node imageDownloader.js <URL>");
    }
}

module.exports = { processProductUrl };
