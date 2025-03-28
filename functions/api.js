const { Pool } = require('pg');

// Configure PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    // Get the path without the /.netlify/functions/api prefix
    const path = event.path.replace('/.netlify/functions/api/', '');
    console.log('Path:', path); // Debug log

    // Handle /api/tables endpoint
    if (path === '' || path === 'tables') {
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'job_costs%'
      `;
      const result = await pool.query(query);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows.map(row => row.table_name))
      };
    }

    // Handle /api/data/[table] endpoint
    if (path.startsWith('data/')) {
      const table = path.replace('data/', '');
      // Validate table name to prevent SQL injection
      if (!table.match(/^job_costs[a-z_]*$/)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid table name' })
        };
      }
      const query = `SELECT * FROM ${table}`;
      const result = await pool.query(query);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    // Handle /api/columns/[table] endpoint
    if (path.startsWith('columns/')) {
      const table = path.replace('columns/', '');
      // Validate table name to prevent SQL injection
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
      const result = await pool.query(query, [table]);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows)
      };
    }

    // If no matching route is found
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
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};
