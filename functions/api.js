const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://kdhwrlhzevzekoanusbs.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    hasKey: !!process.env.SUPABASE_ANON_KEY
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
        // Try to query all tables
        const { data, error } = await supabase.rpc('get_all_tables');
        
        if (error) {
          console.error('Error fetching tables:', error);
          // If RPC fails, try a direct query
          const { data: tables, error: tablesError } = await supabase
            .from('pg_tables')
            .select('tablename')
            .eq('schemaname', 'public');
          
          if (tablesError) {
            console.error('Error fetching tables directly:', tablesError);
            // Return a comprehensive hardcoded list as fallback
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
          
          // Extract table names
          const tableNames = tables.map(row => row.tablename);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(tableNames)
          };
        }
        
        // Return the data from the RPC call
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(data)
        };
      } catch (error) {
        console.error('Error in /tables endpoint:', error);
        // Return a comprehensive hardcoded list as fallback
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

    // Handle /columns/[table] endpoint
    if (path.startsWith('columns/')) {
      const table = path.replace('columns/', '').split('?')[0];
      
      // Get a sample row to determine columns
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
