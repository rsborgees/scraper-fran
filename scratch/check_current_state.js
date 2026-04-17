const { supabase } = require('../supabaseClient');

async function checkCurrentState() {
    console.log('--- Supabase State Check ---');
    
    // Check total count
    const { count: totalCount, error: totalError } = await supabase
        .from('produtos')
        .select('*', { count: 'exact', head: true });
        
    if (totalError) {
        console.error('Error fetching total count:', totalError.message);
    } else {
        console.log(`Total items in 'produtos' table: ${totalCount}`);
    }

    // Check today items using different possible columns
    const today = '2026-04-14';
    
    for (const col of ['sent_at', 'hora_entrada', 'hora_envio']) {
        const { count, error } = await supabase
            .from('produtos')
            .select('*', { count: 'exact', head: true })
            .gte(col, `${today}T00:00:00.000Z`);
            
        if (error) {
            console.error(`Error fetching today count for ${col}:`, error.message);
        } else {
            console.log(`Items from today (>= ${today}) in ${col}: ${count}`);
        }
    }
    
    // Get samples of timestamps to see what's actually there
    if (totalCount > 0) {
        const { data: samples, error: sampleError } = await supabase
            .from('produtos')
            .select('sent_at, hora_entrada, hora_envio')
            .order('hora_entrada', { ascending: false })
            .limit(5);
            
        if (sampleError) {
            console.error('Error fetching samples:', sampleError.message);
        } else {
            console.log('Latest 5 items timestamps:');
            samples.forEach(s => console.log(`  - sent_at: ${s.sent_at}, hora_entrada: ${s.hora_entrada}, hora_envio: ${s.hora_envio}`));
        }
    }
}

checkCurrentState();
