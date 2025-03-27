const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// API Routes

// Get all available tables
app.get('/api/tables', async (req, res) => {
  try {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Get table columns
app.get('/api/columns/:table', async (req, res) => {
  try {
    const { table } = req.params;
    // Validate table name to prevent SQL injection
    if (!table.match(/^[a-zA-Z0-9_]+$/)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const query = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;
    const result = await pool.query(query, [table]);
    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching columns for table ${req.params.table}:`, error);
    res.status(500).json({ error: 'Failed to fetch table columns' });
  }
});

// Get data from a specific table with pagination
app.get('/api/data/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    // Validate table name to prevent SQL injection
    if (!table.match(/^[a-zA-Z0-9_]+$/)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM "${table}"`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count);
    
    // Get paginated data
    const dataQuery = `SELECT * FROM "${table}" LIMIT $1 OFFSET $2`;
    const dataResult = await pool.query(dataQuery, [limit, offset]);
    
    res.json({
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: dataResult.rows
    });
  } catch (error) {
    console.error(`Error fetching data from table ${req.params.table}:`, error);
    res.status(500).json({ error: 'Failed to fetch table data' });
  }
});

// Get summary statistics for a table
app.get('/api/stats/:table', async (req, res) => {
  try {
    const { table } = req.params;
    
    // Validate table name to prevent SQL injection
    if (!table.match(/^[a-zA-Z0-9_]+$/)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    // First get the columns to identify numeric columns
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      AND data_type IN ('numeric', 'decimal', 'real', 'double precision', 'integer', 'bigint')
    `;
    const columnsResult = await pool.query(columnsQuery, [table]);
    
    if (columnsResult.rows.length === 0) {
      return res.json({ message: 'No numeric columns found for statistics' });
    }
    
    // Build a query to get statistics for all numeric columns
    const numericColumns = columnsResult.rows.map(col => col.column_name);
    
    let statsQuery = 'SELECT ';
    numericColumns.forEach((col, index) => {
      statsQuery += `
        AVG("${col}") as "${col}_avg",
        MIN("${col}") as "${col}_min",
        MAX("${col}") as "${col}_max",
        SUM("${col}") as "${col}_sum"
      `;
      if (index < numericColumns.length - 1) {
        statsQuery += ', ';
      }
    });
    statsQuery += ` FROM "${table}" WHERE `;
    
    // Add conditions to filter out null values for each column
    numericColumns.forEach((col, index) => {
      statsQuery += `"${col}" IS NOT NULL`;
      if (index < numericColumns.length - 1) {
        statsQuery += ' OR ';
      }
    });
    
    const statsResult = await pool.query(statsQuery);
    res.json(statsResult.rows[0]);
  } catch (error) {
    console.error(`Error fetching statistics for table ${req.params.table}:`, error);
    res.status(500).json({ error: 'Failed to fetch table statistics' });
  }
});

// Search within a table
app.get('/api/search/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { query, limit = 100, offset = 0 } = req.query;
    
    // Validate table name to prevent SQL injection
    if (!table.match(/^[a-zA-Z0-9_]+$/)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Get the columns for the table
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `;
    const columnsResult = await pool.query(columnsQuery, [table]);
    
    // Build a search query that looks in all text and varchar columns
    const textColumns = columnsResult.rows
      .filter(col => ['text', 'character varying'].includes(col.data_type))
      .map(col => col.column_name);
    
    if (textColumns.length === 0) {
      return res.json({
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        data: []
      });
    }
    
    let searchConditions = textColumns.map(col => `"${col}"::text ILIKE $1`).join(' OR ');
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM "${table}" 
      WHERE ${searchConditions}
    `;
    const countResult = await pool.query(countQuery, [`%${query}%`]);
    const total = parseInt(countResult.rows[0].count);
    
    // Get paginated search results
    const searchQuery = `
      SELECT * 
      FROM "${table}" 
      WHERE ${searchConditions}
      LIMIT $2 OFFSET $3
    `;
    const searchResult = await pool.query(searchQuery, [`%${query}%`, limit, offset]);
    
    res.json({
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: searchResult.rows
    });
  } catch (error) {
    console.error(`Error searching in table ${req.params.table}:`, error);
    res.status(500).json({ error: 'Failed to search table' });
  }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
