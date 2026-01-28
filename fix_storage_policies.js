// Fix storage RLS policies for local development
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'http://127.0.0.1:54321',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImV4cCI6MjAwMDAwMDAwMCwicmVmIjoiaW1nZXJuYW5vLXJlcG8iLCJpYXQiOjE3Njk2MzYzODV9.hDwONiDIPsdHvFXu2J2fQsaYXdRyIYy_CeOppuYqTOg'
);

async function createStoragePolicies() {
    console.log('Creating storage policies for images bucket...');

    // Use raw SQL via the REST API
    const sql = `
        -- Drop existing policies if any
        DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
        DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
        DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
        DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;
        
        -- Create new policies
        -- Allow authenticated users to upload to the images bucket
        CREATE POLICY "Authenticated users can upload images" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'images');
        
        -- Allow anyone to view images (public bucket)
        CREATE POLICY "Anyone can view images" ON storage.objects
        FOR SELECT TO anon, authenticated
        USING (bucket_id = 'images');
        
        -- Allow users to update their own images
        CREATE POLICY "Users can update their own images" ON storage.objects
        FOR UPDATE TO authenticated
        USING (bucket_id = 'images')
        WITH CHECK (bucket_id = 'images');
        
        -- Allow users to delete their own images
        CREATE POLICY "Users can delete their own images" ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'images');
    `;

    // Execute via direct postgres connection
    const response = await fetch('http://127.0.0.1:54321/rest/v1/rpc/exec_sql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImV4cCI6MjAwMDAwMDAwMCwicmVmIjoiaW1nZXJuYW5vLXJlcG8iLCJpYXQiOjE3Njk2MzYzODV9.hDwONiDIPsdHvFXu2J2fQsaYXdRyIYy_CeOppuYqTOg',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImV4cCI6MjAwMDAwMDAwMCwicmVmIjoiaW1nZXJuYW5vLXJlcG8iLCJpYXQiOjE3Njk2MzYzODV9.hDwONiDIPsdHvFXu2J2fQsaYXdRyIYy_CeOppuYqTOg'
        },
        body: JSON.stringify({ sql_string: sql })
    });

    if (!response.ok) {
        console.log('RPC method not available, trying alternative...');
        // Alternative: direct connection via pg
        // For now, just output the SQL to run manually
        console.log('\n=== Run this SQL in Supabase Studio (http://127.0.0.1:54323) ===\n');
        console.log(sql);
        console.log('\n=== End SQL ===\n');
    } else {
        console.log('Policies created successfully!');
    }
}

createStoragePolicies();
