-- SQL query to list all tables in the database
SELECT 
    table_name
FROM 
    information_schema.tables
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name;

-- Alternative query using pg_catalog (if the above doesn't work)
SELECT 
    tablename AS table_name
FROM 
    pg_catalog.pg_tables
WHERE 
    schemaname = 'public'
ORDER BY 
    tablename;

-- Query to get both tables and views
SELECT
    table_name,
    'TABLE' AS object_type
FROM
    information_schema.tables
WHERE
    table_schema = 'public'
UNION ALL
SELECT
    table_name,
    'VIEW' AS object_type
FROM
    information_schema.views
WHERE
    table_schema = 'public'
ORDER BY
    table_name;

-- Query to get table names and row counts
SELECT
    t.table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') AS column_count,
    pg_total_relation_size(quote_ident(t.table_name)) AS total_bytes
FROM
    information_schema.tables t
WHERE
    t.table_schema = 'public'
ORDER BY
    total_bytes DESC,
    t.table_name;
