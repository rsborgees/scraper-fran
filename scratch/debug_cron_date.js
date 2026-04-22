
const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const currentHourBRT = nowBRT.getHours();
const todayBRT = nowBRT.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');

console.log('nowBRT:', nowBRT.toISOString());
console.log('currentHourBRT:', currentHourBRT);
console.log('todayBRT:', todayBRT);

const fs = require('fs');
const path = require('path');
const DRIVE_SYNC_FLAG_FILE = path.join(__dirname, '..', 'data', 'last_drive_sync.json');

function getLastDriveSyncDate() {
    try {
        if (!fs.existsSync(DRIVE_SYNC_FLAG_FILE)) return null;
        const data = JSON.parse(fs.readFileSync(DRIVE_SYNC_FLAG_FILE, 'utf8'));
        return data.lastRunDate || null; // Format: 'YYYY-MM-DD'
    } catch (e) {
        return null;
    }
}

const lastRunDate = getLastDriveSyncDate();
console.log('lastRunDate from file:', lastRunDate);
console.log('Comparison (lastRunDate !== todayBRT):', lastRunDate !== todayBRT);
