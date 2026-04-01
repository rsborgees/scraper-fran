const { supabase } = require('./supabaseClient');
require('dotenv').config();

async function checkToday() {
    console.log(`🔍 Buscando produtos no banco (Considerando todos como sendo de hoje)...`);

    const { data, error } = await supabase
        .from('produtos')
        .select('loja, bazar, favorito, novidade, sent_at');

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    console.log(`📊 Total de produtos no banco: ${data.length}`);
    const stats = { farm: 0, dressto: 0, live: 0, kju: 0, zzmall: 0 };
    data.forEach(item => {
        const store = (item.loja || '').toLowerCase();
        const storeKey = (store === 'dress' || store === 'dressto') ? 'dressto' : store;
        if (stats[storeKey] !== undefined) stats[storeKey]++;
    });
    console.log('📦 Por loja:', stats);
    
    // Metas Ideais
    const IDEAL = { farm: 116, dressto: 25, live: 13, kju: 8, zzmall: 3 };
    console.log('\n⚖️  Gaps até a meta (165):');
    Object.keys(IDEAL).forEach(s => {
        const current = stats[s] || 0;
        const target = IDEAL[s];
        const gap = Math.max(0, target - current);
        console.log(`   🔸 ${s.toUpperCase().padEnd(7)}: ${current}/${target} (Falta: ${gap})`);
    });

    // Check Bazar
    const bazar = data.filter(i => i.bazar || i.isBazar).length;
    console.log(`\n🔥 Bazar: ${bazar}`);
}

checkToday();
