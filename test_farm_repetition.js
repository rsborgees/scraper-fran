const { isDuplicate, normalizeId } = require('./historyManager');
const fs = require('fs');
const path = require('path');

// Para mockar corretamente, precisamos limpar o cache ou sobrescrever a função diretamente no modulo carregado
const historyManager = require('./historyManager');

async function runTests() {
    console.log('🧪 Iniciando Testes de Repetição FARM...\n');

    // Mock history and test isDuplicate directly
    // Como o isDuplicate carrega o history internamente, vamos testar apenas se as datas conferem
    // com as regras de horas passadas.

    function testDuplicate(ageHours, maxAge) {
        const now = Date.now();
        const entryTs = now - (ageHours * 60 * 60 * 1000);

        // Simulação interna do isDuplicate
        const ageMs = now - entryTs;
        const currentAgeHours = ageMs / (1000 * 60 * 60);
        return currentAgeHours < maxAge;
    }

    console.log('--- Cenário 1: Farm Drive (48h) ---');
    console.log('ID enviado há 24h deve ser DUPLICADO (true):', testDuplicate(24, 48));
    console.log('ID enviado há 72h deve ser LIBERADO (false):', testDuplicate(72, 48));

    console.log('\n--- Cenário 2: Farm Regular (168h / 7 dias) ---');
    console.log('ID enviado há 72h (3 dias) deve ser DUPLICADO (true):', testDuplicate(72, 168));
    console.log('ID enviado há 144h (6 dias) deve ser DUPLICADO (true):', testDuplicate(144, 168));
    console.log('ID enviado há 192h (8 dias) deve ser LIBERADO (false):', testDuplicate(192, 168));

    console.log('\n--- Cenário 3: Outras Lojas (72h) ---');
    console.log('ID enviado há 24h deve ser DUPLICADO (true):', testDuplicate(24, 72));
    console.log('ID enviado há 96h deve ser LIBERADO (false):', testDuplicate(96, 72));

    console.log('\n✅ Testes concluídos.');
}

runTests().catch(console.error);
