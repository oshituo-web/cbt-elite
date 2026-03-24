require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function makeAdmin() {
    const emailToFind = 'oshituo@gmail.com';
    
    console.log(`Updating ${emailToFind} to admin...`);
    const { data, error } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('email', emailToFind)
        .select();

    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Success! Updated user:", data);
    }
}

makeAdmin();
