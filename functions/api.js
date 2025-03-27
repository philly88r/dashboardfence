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

  const path = event.path.replace('/.netlify/functions/api/', '');
  const segments = path.split('/');

  try {
    // Handle different API endpoints
    if (path === 'tables') {
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

    if (segments[0] === 'data' && segments[1]) {
      const table = segments[1];
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

    if (segments[0] === 'columns' && segments[1]) {
      const table = segments[1];
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

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not Found' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
