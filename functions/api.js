const { Pool } = require('pg');

// Configure PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test database connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
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

  try {
    // Log environment variables (excluding sensitive data)
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL_EXISTS: !!process.env.DATABASE_URL
    });

    // Test database connection first
    try {
      const client = await pool.connect();
      console.log('Successfully connected to database');
      client.release();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Database Connection Error',
          message: dbError.message
        })
      };
    }

    // Extract path without the prefix
    const path = event.path.replace('/.netlify/functions/api/', '');
    console.log('API Request Path:', path);

    // Handle /tables endpoint
    if (path === 'tables' || path === '') {
      console.log('Fetching tables...');
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'job_costs%'
      `;
      console.log('Executing query:', query);
      const result = await pool.query(query);
      console.log('Query result:', result.rows);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows.map(row => row.table_name))
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
      const query = `SELECT * FROM ${table} LIMIT 1000`;
      console.log('Executing query:', query);
      const result = await pool.query(query);
      console.log('Query result count:', result.rows.length);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          data: result.rows,
          total: result.rows.length
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
      const query = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `;
      console.log('Executing query:', query);
      const result = await pool.query(query, [table]);
      console.log('Query result:', result.rows);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Not Found',
        path: path,
        event: {
          path: event.path,
          httpMethod: event.httpMethod
        }
      })
    };

  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        detail: error.detail,
        code: error.code
      })
    };
  }
};
