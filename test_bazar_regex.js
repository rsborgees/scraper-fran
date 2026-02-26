const bazarRegex = /(?:[/?&])bazar(?:[/\?=&]|$)/i;

const tests = [
    { url: "https://www.farmrio.com.br/bazar/vestido-floral-355028/p", expected: true, desc: "Bazar section URL" },
    { url: "https://www.farmrio.com.br/vestido-estampa-bazar-355028/p", expected: false, desc: "Product name contains 'bazar'" },
    { url: "https://www.farmrio.com.br/p/search?bazar=true", expected: true, desc: "Bazar parameter" },
    { url: "https://www.farmrio.com.br/vestido-bazar-delicado/p", expected: false, desc: "Slug with bazar in middle" },
    { url: "https://www.farmrio.com.br/bazar?utm_source=test", expected: true, desc: "Bazar path with query" },
    { url: "https://www.farmrio.com.br/vestido/p?test=bazar", expected: false, desc: "Query value contains bazar" },
    { url: "https://www.farmrio.com.br/vestido?bazar", expected: true, desc: "Bazar flag at end" }
];

console.log("🧪 Testing Refined Bazar Regex Patterns\n");

tests.forEach(t => {
    const result = bazarRegex.test(t.url);
    const pass = result === t.expected;
    console.log(`${pass ? '✅' : '❌'} [${t.desc}] -> ${t.url}`);
    console.log(`      Result: ${result} | Expected: ${t.expected}`);
});

const allPassed = tests.every(t => bazarRegex.test(t.url) === t.expected);
if (allPassed) {
    console.log("\n✨ ALL REGEX TESTS PASSED!");
} else {
    console.log("\n⚠️ SOME TESTS FAILED.");
}
