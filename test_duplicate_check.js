const { isDuplicate, normalizeId, markAsSent, loadHistory } = require('./historyManager');

const testIds = ["351062", "353006", "351155", "352182", "353009", "363661", "319670"];

console.log("Loading history...");
const history = loadHistory();
console.log("History size:", history.length);

testIds.forEach(id => {
    const normId = normalizeId(id);
    const duplicated = isDuplicate(id);
    console.log(`ID: ${id} -> Norm: ${normId} -> Duplicate: ${duplicated}`);
});
