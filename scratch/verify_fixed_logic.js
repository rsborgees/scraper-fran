
const { getTodayBRTISO, getTodayBRTString } = require('../cronScheduler');

console.log('--- Date Verification ---');
console.log('Today ISO (YYYY-MM-DD):', getTodayBRTISO());
console.log('Today DB String (DD/MM/YYYY):', getTodayBRTString());

const now = new Date();
const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false
});
console.log('Current Hour in BRT:', parseInt(formatter.format(now)));

const { supabase } = require('../supabaseClient');

async function testSupabaseFilter() {
    const today = getTodayBRTString();
    console.log(`\n--- Supabase Filter Test (Today: ${today}) ---`);
    try {
        const { data, error, count } = await supabase
            .from('produtos')
            .select('id, nome, hora_entrada', { count: 'exact' })
            .like('hora_entrada', `${today}%`);
            
        if (error) throw error;
        
        console.log(`✅ Success! Found ${count} items for today.`);
        if (data.length > 0) {
            console.log('Sample item:', data[0]);
        }
    } catch (e) {
        console.error('❌ Supabase Filter Failed:', e.message);
    }
}

testSupabaseFilter();
