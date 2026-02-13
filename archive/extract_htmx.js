const fs = require('fs');
const filePath = 'C:\\Users\\Rafa\\.gemini\\antigravity\\brain\\b75be3cf-b909-4e06-acb3-741cf0a5acd1\\captured_novidades.html';
const content = fs.readFileSync(filePath, 'utf-8');

const hxPostRegex = /hx-post="([^"]+)"/g;
const hxGetRegex = /hx-get="([^"]+)"/g;
const hxTargetRegex = /hx-target="([^"]+)"/g;

let match;
while ((match = hxPostRegex.exec(content)) !== null) {
    console.log(`HX-POST: ${decodeURIComponent(match[1])}`);
}
while ((match = hxGetRegex.exec(content)) !== null) {
    console.log(`HX-GET: ${decodeURIComponent(match[1])}`);
}
