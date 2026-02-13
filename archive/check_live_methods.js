const { initBrowser } = require('./browser_setup');

async function testLive() {
    const { browser, page } = await initBrowser();
    try {
        const testId = '52347'; // Bermuda from previous test
        const testUrl = `https://www.liveoficial.com.br/${testId}?map=ft`;

        console.log(`Testing Direct ID URL: ${testUrl}`);
        await page.goto(testUrl, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(5000);
        console.log(`Final URL after ID lookup: ${page.url()}`);

        const testName = 'Bermuda Dou Collor';
        console.log(`Testing Name Search: ${testName}`);
        await page.goto('https://www.liveoficial.com.br/', { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(3000);

        const searchInput = 'input.bn-search__input';
        await page.waitForSelector(searchInput);
        await page.fill(searchInput, testName);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(8000);
        console.log(`Final URL after Name Search: ${page.url()}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testLive();
