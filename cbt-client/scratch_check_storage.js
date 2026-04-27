import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://hwmbmbxblftpkqikbiff.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3bWJtYnhibGZ0cGtxaWtiaWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDQ4MzUsImV4cCI6MjA3ODYyMDgzNX0.xhketgRsZRkUWirAi1Clj2M0_fyfgc-I0RfFV0EhCGY"

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBuckets() {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) {
        console.error("Error fetching buckets:", error)
        return
    }
    console.log("Storage Buckets:")
    data.forEach(b => console.log(`- ${b.name} (${b.public ? 'Public' : 'Private'})`))
}

checkBuckets()
