
const normalizedCat = "calçado";
const regex = /\bcalça\b/;
console.log(`Testing "${normalizedCat}" against ${regex}:`, regex.test(normalizedCat));

// Let's see what \b thinks
const str = "calçado";
const parts = str.split(/\b/);
console.log("Parts split by \\b:", parts);
