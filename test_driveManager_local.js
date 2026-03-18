require('dotenv').config();
const { getExistingIdsFromDrive } = require('./driveManager');
async function test() {
    console.log('Fetching...');
    const items = await getExistingIdsFromDrive('1qbxff0X2IvYJpaoZTwhH0SkuRVVQRbeU');
    const noFarmTag = items.filter(i => i.store === 'farm' && !i.name.toLowerCase().includes('farm'));
    console.log('Items parsed as farm but without farm in name: ' + noFarmTag.length);
    noFarmTag.slice(0, 10).forEach(i => console.log('- ' + i.name));
}
test();
