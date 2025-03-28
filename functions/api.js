const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// Initialize Supabase client
const supabaseUrl = 'https://kdhwrlhzevzekoanusbs.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize PostgreSQL connection pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Yitbos88@db.kdhwrlhzevzekoanusbs.supabase.co:5432/postgres'
});

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  // Log request details for debugging
  console.log('Request event:', {
    path: event.path,
    httpMethod: event.httpMethod,
    hasKey: !!process.env.SUPABASE_ANON_KEY,
    hasDbUrl: !!process.env.DATABASE_URL
  });
  
  try {
    // Handle different path formats
    let path = event.path;
    if (path.includes('/.netlify/functions/api/')) {
      path = path.replace('/.netlify/functions/api/', '');
    } else if (path.includes('/api/')) {
      path = path.replace('/api/', '');
    }
    
    console.log('Normalized path:', path);

    // Handle /tables endpoint
    if (path === 'tables' || path === '') {
      try {
        // Use direct PostgreSQL connection to get all tables
        const client = await pgPool.connect();
        const result = await client.query(`
          SELECT 
            table_name
          FROM 
            information_schema.tables
          WHERE 
            table_schema = 'public'
          ORDER BY 
            table_name;
        `);
        client.release();
        
        // Extract table names
        const tables = result.rows.map(row => row.table_name);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(tables)
        };
      } catch (pgError) {
        console.error('Error querying PostgreSQL directly:', pgError);
        
        // Fallback to hardcoded list of all tables
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify([
            'calendar_sync_tokens',
            'categories',
            'chainlink_products',
            'customer_appointments',
            'customer_files',
            'customer_notes',
            'customer_projects',
            'customers',
            'estimate_calculator_inputs',
            'estimate_fence_materials',
            'estimate_line_items',
            'estimates',
            'events',
            'feedback',
            'formula_products',
            'google_calendar_tokens',
            'job_cost',
            'job_costs',
            'job_costs_actual_monthly',
            'job_costs_cash_flow',
            'job_costs_income',
            'job_costs_jeff_yates',
            'job_costs_parameters',
            'job_costs_paul_vincent',
            'job_costs_prediction',
            'job_costs_sales_rep',
            'job_costs_scott_w',
            'job_costs_summary',
            'material_formulas',
            'materials',
            'message_history',
            'monthly_job_cost',
            'monthly_job_cost_view',
            'post_heights',
            'price_book_products',
            'price_list',
            'product_details',
            'products',
            'project_files',
            'project_tasks',
            'project_updates',
            'questionnaire',
            'sales_activities',
            'user_customers',
            'vendor_categories',
            'vendors'
          ])
        };
      }
    }

    // Handle /data/[table] endpoint
    if (path.startsWith('data/')) {
      const table = path.replace('data/', '').split('?')[0];
      
      try {
        // Use direct PostgreSQL connection to get table data
        const client = await pgPool.connect();
        const result = await client.query(`
          SELECT * FROM "${table}" LIMIT 100;
        `);
        client.release();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            data: result.rows,
            total: result.rows.length
          })
        };
      } catch (pgError) {
        console.error(`Error querying table ${table} directly:`, pgError);
        
        // Fallback to Supabase
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(100);
        
        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            data: data || [],
            total: (data || []).length
          })
        };
      }
    }

    // Handle /columns/[table] endpoint
    if (path.startsWith('columns/')) {
      const table = path.replace('columns/', '').split('?')[0];
      
      try {
        // Use direct PostgreSQL connection to get column info
        const client = await pgPool.connect();
        const result = await client.query(`
          SELECT 
            column_name, 
            data_type 
          FROM 
            information_schema.columns 
          WHERE 
            table_schema = 'public' 
            AND table_name = $1
          ORDER BY 
            ordinal_position;
        `, [table]);
        client.release();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result.rows)
        };
      } catch (pgError) {
        console.error(`Error querying columns for ${table} directly:`, pgError);
        
        // Fallback to getting a sample row
        try {
          const client = await pgPool.connect();
          const result = await client.query(`
            SELECT * FROM "${table}" LIMIT 1;
          `);
          client.release();
          
          if (result.rows.length > 0) {
            // Extract columns from the first row
            const columns = Object.keys(result.rows[0]).map(col => ({
              column_name: col,
              data_type: typeof result.rows[0][col]
            }));
            
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(columns)
            };
          }
        } catch (sampleError) {
          console.error(`Error getting sample row from ${table}:`, sampleError);
        }
        
        // If all else fails, use Supabase
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.error('Error fetching columns:', error);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify([
              { column_name: 'id', data_type: 'integer' },
              { column_name: 'job_id', data_type: 'text' },
              { column_name: 'customer', data_type: 'text' },
              { column_name: 'amount', data_type: 'numeric' },
              { column_name: 'date', data_type: 'date' }
            ])
          };
        }
        
        // Extract columns from the first row
        const columns = Object.keys(data[0] || {}).map(col => ({
          column_name: col,
          data_type: typeof data[0][col]
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(columns)
        };
      }
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        error: 'Not Found', 
        path: path,
        originalPath: event.path
      })
    };

  } catch (error) {
    console.error('Error details:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'API Error',
        message: error.message,
        details: error.details || 'No additional details'
      })
    };
  }
};
