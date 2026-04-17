const { supabase } = require('../supabaseClient');

async function checkPast5AM() {
    console.log('--- Checking past 5 AM entries ---');
    
    // Search for anything from past days at 05:xx
    const { data, error } = await supabase
        .from('produtos')
        .select('hora_entrada')
        .like('hora_entrada', '% 05:%')
        .limit(10);
        
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} items from 5 AM in the past.`);
        data.forEach(p => console.log(`  - ${p.hora_entrada}`));
    }
}

checkPast5AM();
