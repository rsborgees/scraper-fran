const { supabase } = require('./supabaseClient');

async function countProducts() {
    try {
        const { count, error } = await supabase
            .from('produtos')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        console.log(`📊 Total de produtos no Supabase: ${count}`);
    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

countProducts();
