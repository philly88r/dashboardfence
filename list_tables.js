const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://kdhwrlhzevzekoanusbs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_ANON_KEY environment variable is not set.');
  console.error('Please set it before running this script:');
  console.error('  On Windows: set SUPABASE_ANON_KEY=your_key_here');
  console.error('  On Mac/Linux: export SUPABASE_ANON_KEY=your_key_here');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listAllTables() {
  console.log('Listing all tables in Supabase database...');
  
  try {
    // Method 1: Try to query pg_tables directly
    const { data: pgTables, error: pgError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (!pgError && pgTables && pgTables.length > 0) {
      const tables = pgTables.map(row => row.tablename);
      console.log(`Found ${tables.length} tables using pg_catalog.pg_tables:`);
      tables.forEach((table, i) => console.log(`${i+1}. ${table}`));
      return;
    } else if (pgError) {
      console.log('Error querying pg_catalog.pg_tables:', pgError.message);
    }
    
    // Method 2: Try a simple query on each potential table
    console.log('Trying alternative method to list tables...');
    const potentialTables = [
      'job_costs',
      'job_costs_summary',
      'job_costs_paul_vincent',
      'job_costs_scott_w',
      'job_costs_all_jobs',
      'job_costs_all_jobs_summary',
      'job_costs_all_jobs_by_month',
      'job_costs_by_customer',
      'job_costs_by_date',
      'job_costs_by_sales_rep',
      'job_costs_by_job_id',
      'job_costs_by_month',
      'job_costs_by_year',
      'job_costs_by_quarter',
      'job_costs_by_week',
      'job_costs_by_day',
      'job_costs_by_category',
      'job_costs_by_type',
      'job_costs_by_status',
      'job_costs_by_region',
      'job_costs_by_department',
      'job_costs_by_employee',
      'job_costs_by_vendor',
      'job_costs_by_project',
      'job_costs_by_phase',
      'job_costs_by_task'
    ];
    
    const existingTables = [];
    
    // Test each table by trying to select from it
    for (const table of potentialTables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!error) {
        existingTables.push(table);
      }
    }
    
    if (existingTables.length > 0) {
      console.log(`Found ${existingTables.length} accessible tables:`);
      existingTables.forEach((table, i) => console.log(`${i+1}. ${table}`));
    } else {
      console.log('No tables found or could not access any tables.');
    }
    
  } catch (error) {
    console.error('Error listing tables:', error.message);
  }
}

// Run the function
listAllTables();
