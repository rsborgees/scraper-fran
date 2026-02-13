const fs = require('fs');

// Mock a simplified driveManager logic
function extractIds(filename) {
    const allIds = filename.match(/\d{6,}/g) || [];
    let ids = [];

    if (allIds.length > 1) {
        const id1 = allIds[0];
        const id2 = allIds[1];
        const between = filename.substring(filename.indexOf(id1) + id1.length, filename.indexOf(id2));

        if (between.includes('_')) {
            ids = [id1];
        } else {
            ids = allIds;
        }
    } else {
        ids = allIds;
    }
    return ids;
}

const tests = [
    { name: "Conjunto simples", file: "351693 350740 farm.jpg", expected: ["351693", "350740"] },
    { name: "Underline (Nao conjunto)", file: "351693_350740 farm.jpg", expected: ["351693"] },
    { name: "ID unico com underline", file: "farm_351693_favorito.jpg", expected: ["351693"] },
    { name: "Espaco extra", file: "farm  351693   350740 .jpg", expected: ["351693", "350740"] },
    { name: "IDs no meio do texto", file: "Promo Farm 351693 e 350740.jpg", expected: ["351693", "350740"] }
];

console.log('🧪 Testando extração de IDs...');
tests.forEach(t => {
    const result = extractIds(t.file);
    const success = JSON.stringify(result) === JSON.stringify(t.expected);
    console.log(`${success ? '✅' : '❌'} ${t.name}: "${t.file}" -> ${JSON.stringify(result)} (Esperado: ${JSON.stringify(t.expected)})`);
});
