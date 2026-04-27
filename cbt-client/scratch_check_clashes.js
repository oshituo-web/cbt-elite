import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://hwmbmbxblftpkqikbiff.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3bWJtYnhibGZ0cGtxaWtiaWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDQ4MzUsImV4cCI6MjA3ODYyMDgzNX0.xhketgRsZRkUWirAi1Clj2M0_fyfgc-I0RfFV0EhCGY"

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkClashes() {
    const { data, error } = await supabase
        .from('scheduled_clashes')
        .select('*')
        .gte('week_date', '2026-04-15')
        .order('week_date', { ascending: false })
    
    if (error) {
        console.error("Error fetching clashes:", error)
        return
    }
    
    console.log("Scheduled Clashes:")
    if (data.length === 0) {
        console.log("No clashes found since 2026-04-15.")
    } else {
        data.forEach(c => {
            console.log(`- Date: ${c.week_date}, Type: ${c.type}, Dept: ${c.department}`)
        })
    }
}

checkClashes()
