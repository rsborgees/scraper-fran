
function calculateQuotas(quota) {
    console.log(`\n--- Quota: ${quota} ---`);

    // Distribuição: 75% vestidos, 10% macacão, 5% saia, 5% short, 5% blusa
    const quotas = {
        'vestido': Math.floor(quota * 0.75), // Usa floor primeiro
        'macacão': Math.round(quota * 0.10),
        'saia': Math.round(quota * 0.05),
        'short': Math.round(quota * 0.05),
        'blusa': Math.round(quota * 0.05),
        'acessório': 0 // Zero para focar em roupas
    };

    console.log('Initial Quotas:', quotas);

    let totalQuotas = Object.values(quotas).reduce((a, b) => a + b, 0);
    console.log('Total Initial:', totalQuotas);

    // Ajusta vestidos para bater a quota exata (sempre positivo)
    const diff = quota - totalQuotas;
    quotas['vestido'] += diff;

    console.log('Adjusted Quotas:', quotas);
    console.log('Final Vestido Count:', quotas['vestido']);
    console.log('Actual %:', ((quotas['vestido'] / quota) * 100).toFixed(1) + '%');

    return quotas;
}

// Testes com as quotas reais
console.log('=== FARM QUOTA (Real) ===');
calculateQuotas(7);  // Quota real da Farm

console.log('\n=== OUTROS TESTES ===');
calculateQuotas(12);
calculateQuotas(84);
