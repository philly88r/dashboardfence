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
    // Get a client from the pool
    const client = await pool.connect();
    console.log('Connected to database');

    try {
      // Log environment variables (excluding sensitive data)
      console.log('Environment check:', {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        DATABASE_URL_EXISTS: !!process.env.DATABASE_URL
      });

      // Test database connection first
      try {
        console.log('Successfully connected to database');
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

      // Log request details for debugging
      console.log('Request event:', {
        path: event.path,
        httpMethod: event.httpMethod,
        hasDatabase: !!process.env.DATABASE_URL
      });
      
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
        const result = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name LIKE 'job_costs%'
        `);
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
        const result = await client.query(`SELECT * FROM ${table} LIMIT 1000`);
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
        const result = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [table]);
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
          originalPath: event.path,
          event: {
            path: event.path,
            httpMethod: event.httpMethod
          }
        })
      };

    } finally {
      // Release the client back to the pool
      client.release();
    }
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
