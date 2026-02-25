function testRegex(fileName) {
    const compositeMatches = fileName.match(/(\d{6,}[_-]\d+|\d{2}\.\d{2}\.\d{4}[_-]\d+)/g) || [];
    const simpleMatches = (fileName.match(/\d{6,}/g) || []).filter(sid => {
        return !compositeMatches.some(cid => cid.includes(sid));
    });
    let ids = [...compositeMatches, ...simpleMatches];
    console.log(`Filename: "${fileName}"`);
    console.log(`IDs extracted:`, ids);
}

testRegex("A5001506080001 ZZMall Novidade.jpg");
testRegex("C5003600320004 ZZMall Favorito.png");
testRegex("357261 Farm Bazar.jpg");
