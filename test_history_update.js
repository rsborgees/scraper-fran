
const { markAsSent, loadHistory } = require('./historyManager');
const fs = require('fs');
const path = require('path');

const historyFile = path.join('data', 'history.json');
const before = fs.statSync(historyFile).mtime;

console.log('Last modified before:', before);
console.log('Marking test_id as sent...');

try {
    markAsSent(['test_id_' + Date.now()]);
    const after = fs.statSync(historyFile).mtime;
    console.log('Last modified after:', after);

    if (after > before) {
        console.log('✅ History file UPDATED successfully.');
    } else {
        console.log('❌ History file NOT updated.');
    }
} catch (e) {
    console.error('❌ Error updating history:', e);
}
