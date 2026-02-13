const fs = require('fs');
const filePath = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1\\captured_novidades.html';
const content = fs.readFileSync(filePath, 'utf-8');

// Regex for Farm product URLs: /something-ID-ID/p or /something-ID/p
const patterns = [
    /\/[\w-]+\d{6,}[-\d]*\/p/g,
    /\/p\?idsku=\d+/g,
    /productID":"(\d{6,})/g
];

patterns.forEach(p => {
    const matches = content.match(p) || [];
    console.log(`Pattern ${p} found ${matches.length} matches.`);
    if (matches.length > 0) {
        console.log(`First 10 matches:`, matches.slice(0, 10));
    }
});
