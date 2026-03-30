const { supabase } = require('./supabaseClient');

async function checkSchema() {
    try {
        const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
            console.log('Keys in produtos table:', Object.keys(data[0]));
        } else {
            console.log('No data found in produtos table.');
        }
    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

checkSchema();
