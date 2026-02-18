
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { getExistingIdsFromDrive } = require('./driveManager');
const { scrapeSpecificIds } = require('./scrapers/farm/idScanner');
const { initBrowser } = require('./browser_setup');
const { buildFarmMessage } = require('./messageBuilder');

async function debugId() {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log('📂 Fetching from Drive...');
    const allDriveItems = await getExistingIdsFromDrive(folderId);

    const item = allDriveItems.find(i => i.id === '363187');
    if (!item) {
        console.error('❌ ID 363187 NOT found in Drive listing.');
        return;
    }

    console.log('✅ Found item in Drive. Props:', {
        id: item.id,
        isFavorito: item.isFavorito,
        novidade: item.novidade,
        store: item.store
    });

    const { browser, context } = await initBrowser();
    try {
        console.log('🔍 Starting scraper for ID 363187...');
        const scraped = await scrapeSpecificIds(context, [item], 999);

        console.log('\n📊 Scrape Result Stats:', scraped.stats);

        if (scraped.products && scraped.products.length > 0) {
            const p = scraped.products[0];
            console.log('✅ Product Found and Scraped:', p.nome);
            p.message = buildFarmMessage(p, p.timerData);
            console.log('✅ Message built. Length:', p.message.length);
        } else {
            console.log('❌ Product NOT returned by scraper.');
        }
    } catch (e) {
        console.error('❌ Error during scrape:', e);
    } finally {
        await browser.close();
    }
}

debugId();
