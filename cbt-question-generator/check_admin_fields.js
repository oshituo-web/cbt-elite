require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAdmin() {
    const emailToFind = 'oshituo@gmail.com';
    
    // Check public.users table for role
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailToFind)
        .maybeSingle();

    if (userData) {
        console.log(`USER KEYS: ${Object.keys(userData).join(', ')}`);
        console.log(`ROLE: ${userData.role}`);
        console.log(`IS_ADMIN: ${userData.is_admin}`);
    } else {
        console.log("User not found in public.users");
    }
}

checkAdmin();
