const { supabase } = require('./supabaseClient');

async function checkDistribution() {
    try {
        const { data, error } = await supabase
            .from('produtos')
            .select('loja');

        if (error) throw error;

        const stats = {
            total: data.length,
            stores: {}
        };

        data.forEach(item => {
            const store = (item.loja || 'unknown').toLowerCase();
            stats.stores[store] = (stats.stores[store] || 0) + 1;
        });

        console.log('📊 Estado Atual do Supabase:');
        console.log(`TOTAL: ${stats.total}/158`);
        Object.entries(stats.stores).forEach(([store, count]) => {
            console.log(`- ${store.toUpperCase()}: ${count}`);
        });

    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

checkDistribution();
