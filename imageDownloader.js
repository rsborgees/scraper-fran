require('dotenv').config();

const { chromium } = require('playwright');
const { existsSync, mkdirSync, createWriteStream, unlink } = require('fs');
const { join } = require('path');
const { get } = require('https');
const cloudinary = require('cloudinary').v2;

// 🔹 Config Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const DOWNLOAD_DIR = join(__dirname, 'downloads');

if (!existsSync(DOWNLOAD_DIR)) {
    mkdirSync(DOWNLOAD_DIR);
}

/**
 * Downloads an image from a URL and saves it to the specified path.
 */
/**
 * Downloads an image from a URL and saves it to the specified path.
 * Supports HTTP redirects (e.g., Google Drive links).
 */
async function downloadImage(url, filepath, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error('Too many redirects'));
            return;
        }

        const request = get(url, (response) => {
            // Handle redirects (status 301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                const redirectUrl = new URL(response.headers.location, url).toString();
                console.log(`   ↪️ Redirecting to: ${redirectUrl}`);
                downloadImage(redirectUrl, filepath, maxRedirects - 1).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to consume '${url}', status code: ${response.statusCode}`));
                return;
            }

            const file = createWriteStream(filepath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(filepath);
            });
            file.on('error', (err) => {
                unlink(filepath, () => { });
                reject(err);
            });
        });

        request.on('error', (err) => {
            unlink(filepath, () => { });
            reject(err);
        });
    });
}

/**
 * Uploads an image to Cloudinary
 */
async function uploadToCloudinary(filepath, publicId) {
    try {
        const res = await cloudinary.uploader.upload(filepath, {
            folder: 'scraper',
            public_id: publicId,
            overwrite: true,
            use_filename: true,
            unique_filename: false
        });

        return res.secure_url;
    } catch (err) {
        console.error('Cloudinary upload failed:', err.message);
        return null;
    }
}

/**
 * Extracts product ID depending on store
 */
async function extractProductId(page, store, url) {
    let id = 'unknown';

    try {
        if (store === 'FARM') {
            const refText = await page.evaluate(() => {
                const el = document.querySelector('.vtex-product-identifier, .productReference, .ref');
                if (el) return el.innerText;
                const body = document.body.innerText;
                const match = body.match(/Ref[:\.]?\s*(\d+)/i);
                return match ? match[1] : '';
            });

            const match = refText.match(/(\d{5,})/);
            if (match) id = match[1].substring(0, 6);
        } else if (store === 'KJU') {
            const kjuId = await page.evaluate(() => {
                const el = document.querySelector('.codigo_produto, [itemprop="identifier"]');
                if (!el) return null;
                const match = el.innerText.match(/\d+/);
                return match ? match[0] : null;
            });
            if (kjuId) id = kjuId;
        } else if (store === 'LIVE') {
            const liveId = await page.evaluate(() => {
                const el = document.querySelector('.vtex-product-identifier, .sku, .productReference');
                if (el) return el.innerText.replace(/\D/g, '');
                // Fallback URL
                const urlMatch = window.location.href.match(/(\d{5,})/);
                return urlMatch ? urlMatch[1] : null;
            });
            if (liveId) id = liveId;
        } else if (store === 'DRESSTO') {
            const dressId = await page.evaluate(() => {
                const el = document.querySelector('.vtex-product-identifier, .productReference');
                if (el) return el.innerText.replace(/\D/g, '');
                const urlMatch = window.location.href.match(/(\d{6,})/);
                return urlMatch ? urlMatch[1] : null;
            });
            if (dressId) id = dressId;
        } else {
            const urlId = url.split('/').pop().split('?')[0].replace(/[^a-zA-Z0-9]/g, '');
            if (urlId.length > 0) id = urlId;

            const visibleRef = await page.evaluate(() => {
                const el = document.querySelector('.sku, .ref, .product-code, .codigo_produto');
                return el ? el.innerText.trim() : null;
            });

            if (visibleRef) {
                const match = visibleRef.match(/\d+/);
                id = match ? match[0] : visibleRef.replace(/[^a-zA-Z0-9]/g, '');
            }
        }
    } catch (e) {
        console.warn(`ID Extraction failed: ${e.message}`);
    }

    return id;
}

/**
 * Main function to process product URL.
 */
async function processProductUrl(url, forcedId = null) {
    console.log(`\nProcessing: ${url}`);

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
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'pt-BR'
    });

    const page = await context.newPage();

    const result = {
        local_paths: [],
        cloudinary_urls: [],
        id: null,
        store,
        status: 'error',
        reason: ''
    };

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Se tivermos um ID forçado (do parser), garantimos que ele está na tela antes de continuar
        if (forcedId) {
            console.log(`   🔍 Aguardando ID ${forcedId} aparecer no DOM...`);
            const idFound = await page.evaluate((targetId) => {
                const check = () => {
                    const bodyText = document.body.innerText;
                    return bodyText.includes(targetId);
                };
                return check();
            }, forcedId);

            if (!idFound) {
                console.log('   ⏳ ID não encontrado de imediato, aguardando 5s para estabilização...');
                await page.waitForTimeout(5000);
            }
        } else {
            await page.waitForTimeout(3000);
        }

        try {
            await page.waitForSelector('img', { timeout: 10000 });
            await page.evaluate(() => window.scrollTo(0, 400));
            await page.waitForTimeout(1000);
        } catch (e) {
            console.log('   ⚠️ Timeout esperando imagens, tentando capturar o que houver...');
        }

        const id = forcedId || await extractProductId(page, store, url);
        result.id = id;

        const imageUrls = await page.evaluate(() => {
            const gallerySelectors = [
                '.product-image',
                '.vtex-store-components-3-x-productImageTag',
                '.swiper-slide-active img',
                '.image-gallery img',
                'img[data-zoom]'
            ];

            let candidates = [];

            for (const sel of gallerySelectors) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) candidates.push(...Array.from(els));
            }

            if (candidates.length === 0) {
                candidates = Array.from(document.querySelectorAll('img'))
                    .filter(img => img.width > 250 && img.height > 250);
            }

            if (candidates.length === 0) {
                const ogImg = document.querySelector('meta[property="og:image"]');
                if (ogImg?.content) return [ogImg.content];
            }

            return candidates
                .map(img => img.currentSrc || img.src)
                .filter(src => src && !src.includes('svg') && !src.includes('data:image'))
                .slice(0, 1);
        });

        if (imageUrls.length === 0) throw new Error('No suitable images found');

        for (const imgUrl of imageUrls) {
            const filename = `${store}_${id}.jpg`;
            const filepath = join(DOWNLOAD_DIR, filename);
            const finalUrl = new URL(imgUrl, url).toString();

            try {
                await downloadImage(finalUrl, filepath);
                result.local_paths.push(filepath);

                // 🔹 Upload to Cloudinary
                const cloudUrl = await uploadToCloudinary(filepath, `${store}_${id}`);
                if (cloudUrl) result.cloudinary_urls.push(cloudUrl);

                // (Opcional) apagar local depois do upload
                unlink(filepath, () => { });
                break;
            } catch (err) {
                console.error(`Download/upload failed: ${err.message}`);
            }
        }

        if (result.cloudinary_urls.length > 0) {
            result.status = 'success';
        } else {
            result.reason = 'Failed to upload or download image';
        }

    } catch (error) {
        result.reason = error.message;
        console.error(`Error processing ${url}:`, error);
    } finally {
        await browser.close();
    }

    return result;
}

/**
 * DIRECT PROCESSOR (Optimized)
 * Downloads and uploads image directly from a URL without opening a browser.
 * Use this when the scraper already has the image URL.
 */
async function processImageDirect(imageUrl, store, id) {
    const result = {
        local_paths: [],
        cloudinary_urls: [],
        id: id,
        store: store,
        status: 'error',
        reason: ''
    };

    try {
        const filename = `${store}_${id}.jpg`;
        const filepath = join(DOWNLOAD_DIR, filename);

        // Download
        await downloadImage(imageUrl, filepath);
        result.local_paths.push(filepath);

        // Upload
        const cloudUrl = await uploadToCloudinary(filepath, `${store}_${id}`);
        if (cloudUrl) {
            result.cloudinary_urls.push(cloudUrl);
            result.status = 'success';
        } else {
            result.reason = 'Cloudinary upload failed';
        }

        // Cleanup
        unlink(filepath, () => { });

    } catch (err) {
        result.reason = err.message;
        console.error(`Error in processImageDirect for ${id}:`, err);
    }

    return result;
}

if (require.main === module) {
    const testUrl = process.argv[2];
    if (testUrl) {
        processProductUrl(testUrl).then(console.log);
    } else {
        console.log("Usage: node imageDownloader.js <URL>");
    }
}

module.exports = { processProductUrl, processImageDirect };
