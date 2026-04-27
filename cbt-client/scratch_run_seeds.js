import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://hwmbmbxblftpkqikbiff.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3bWJtYnhibGZ0cGtxaWtiaWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDQ4MzUsImV4cCI6MjA3ODYyMDgzNX0.xhketgRsZRkUWirAi1Clj2M0_fyfgc-I0RfFV0EhCGY"

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
    const sql = `
    SELECT generate_weekly_clash_seeds();
    `
    // Trying to call the function directly
    const { data, error } = await supabase.rpc('generate_weekly_clash_seeds')
    
    if (error) {
        console.error("Error calling RPC:", error)
        return
    }
    
    console.log("RPC called successfully. Seeds should be generated.")
}

runMigration()
