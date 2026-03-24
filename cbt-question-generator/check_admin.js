require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAdmin() {
    const emailToFind = 'oshituo@gmail.com';
    console.log(`Checking database for user with email: ${emailToFind}`);
    
    // Check public.users table for role
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailToFind)
        .maybeSingle();

    if (userError) {
        console.error("Error querying users table:", userError.message);
    } else if (userData) {
        console.log("Found in public.users:");
        console.log(JSON.stringify(userData, null, 2));
    } else {
        console.log("User not found in public.users table.");
    }
}

checkAdmin();
