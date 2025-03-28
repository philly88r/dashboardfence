const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://kdhwrlhzevzekoanusbs.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Enable CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async function(event, context) {
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
    httpMethod: event.httpMethod
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
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .like('table_name', 'job_costs%');
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data.map(row => row.table_name))
      };
    }

    // Handle /data/[table] endpoint
    if (path.startsWith('data/')) {
      const table = path.replace('data/', '').split('?')[0];
      if (!table.match(/^job_costs[a-z_]*$/)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid table name' })
        };
      }
      
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1000);
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          data: data,
          total: count || data.length
        })
      };
    }

    // Handle /columns/[table] endpoint
    if (path.startsWith('columns/')) {
      const table = path.replace('columns/', '').split('?')[0];
      if (!table.match(/^job_costs[a-z_]*$/)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid table name' })
        };
      }
      
      // For columns we still need to use a raw query since this is meta info
      const { data, error } = await supabase.rpc('get_table_columns', { 
        table_name: table 
      });
      
      if (error) {
        // Fallback to predefined columns if RPC fails
        console.log('Error getting columns:', error);
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
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
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
        details: error.details
      })
    };
  }
};
