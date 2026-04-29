require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const { count, error } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString());
        
    const { count: total, error: tErr } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

    console.log("Questions generated today:", count);
    console.log("Total questions in database:", total);
}
check();
