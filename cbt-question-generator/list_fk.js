require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listForeignKeyTables() {
    console.log("🚀 Listing tables with foreign keys referencing 'questions'...");

    const { data, error } = await supabase.rpc('get_foreign_key_tables', { table_name: 'questions' });

    if (error) {
        console.error("Error fetching foreign key tables:", error.message);
        // Attempt a direct query if RPC fails, though it's more complex
        // This requires direct SQL execution which Supabase client doesn't expose easily without an Edge Function.
        console.log("Attempting to query pg_constraint directly (might require elevated permissions or a custom RPC function in Supabase):");
        const { data: directQuery, error: directQueryError } = await supabase
            .from('pg_constraint') // This table might not be directly queryable
            .select(`
                conrelid,
                conname,
                confrelid
            `)
            .eq('confrelid', 'questions'::regclass) // This syntax is likely problematic
            .eq('contype', 'f');

        if (directQueryError) {
            console.error("Direct query failed:", directQueryError.message);
            console.log("Please ensure you have a 'get_foreign_key_tables' RPC function deployed in Supabase that queries pg_constraint.");
            console.log("Example SQL for the RPC function:");
            console.log("'''sql
CREATE OR REPLACE FUNCTION get_foreign_key_tables(table_name TEXT)
RETURNS TABLE (referencing_table_name REGCLASS, foreign_key_name NAME, constraint_definition TEXT) 
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY 
    SELECT 
      conrelid::regclass,
      conname,
      pg_get_constraintdef(oid)
    FROM 
      pg_constraint 
    WHERE 
      confrelid = table_name::regclass AND contype = 'f';
END;
$$;'''
            );
        }

        return;
    }

    if (data.length > 0) {
        console.log("Tables referencing 'questions':");
        data.forEach(row => {
            console.log(`- Table: ${row.referencing_table_name}, FK Name: ${row.foreign_key_name}, Definition: ${row.constraint_definition}`);
        });
    } else {
        console.log("No tables found referencing 'questions'.");
    }

    console.log("
Finished listing foreign key tables.");
}

listForeignKeyTables().catch(console.error);
