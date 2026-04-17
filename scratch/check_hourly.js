const { supabase } = require('../supabaseClient');

async function check5AM() {
    console.log('--- Checking 5 AM entries ---');
    
    // Search for anything from today at 05:xx
    const { data, error } = await supabase
        .from('produtos')
        .select('nome, loja, hora_entrada')
        .like('hora_entrada', '14/04/2026 05:%');
        
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} items from 5 AM today.`);
        data.forEach(p => console.log(`  - [${p.loja}] ${p.nome} (${p.hora_entrada})`));
    }

    // Also check for 7 AM, 8 AM, etc.
    for (let h = 5; h <= 13; h++) {
        const hour = String(h).padStart(2, '0');
        const { count } = await supabase
            .from('produtos')
            .select('*', { count: 'exact', head: true })
            .like('hora_entrada', `14/04/2026 ${hour}:%`);
        console.log(`Hour ${hour}:00 -> ${count} items`);
    }
}

check5AM();
