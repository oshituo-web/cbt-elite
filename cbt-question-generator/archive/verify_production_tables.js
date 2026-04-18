require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function provisionTables() {
    console.log("🚀 Provisioning Production Tables (if missing)...");
    
    // Suapbase doesn't allow DDL via JS client, but we can verify if the tables were created by the user.
    // I will check the count of tables or try a select.
    
    const tables = ['admin_audit_logs', 'promo_codes', 'system_config'];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error && error.code === '42P01') {
            console.warn(`⚠️ Table ${table} is MISSING. Please run 'production_security.sql' in the Supabase SQL Editor.`);
        } else if (error) {
            console.error(`❌ Error checking ${table}:`, error.message);
        } else {
            console.log(`✅ Table ${table} exists.`);
        }
    }
}

provisionTables();
