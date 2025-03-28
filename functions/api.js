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
    // Extract path without the prefix
    const path = event.path.replace('/.netlify/functions/api/', '');
    console.log('API Request Path:', path);

    // Handle /tables endpoint
    if (path === 'tables' || path === '') {
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
