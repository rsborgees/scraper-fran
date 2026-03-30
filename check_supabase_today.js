const { supabase } = require('./supabaseClient');

async function checkToday() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`🔍 Buscando produtos do dia: ${today}`);

    try {
        const { data, error, count } = await supabase
            .from('produtos')
            .select('*', { count: 'exact' })
            .gte('timestamp', `${today}T00:00:00Z`);

        if (error) throw error;

        console.log(`✅ Encontrados ${count} produtos hoje.`);
        if (data && data.length > 0) {
            data.forEach(p => {
                console.log(`- [${p.loja}] ${p.nome} (${p.id_referencia}) - ${p.timestamp}`);
            });
        }
    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

checkToday();
