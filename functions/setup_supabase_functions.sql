-- Function to get all tables
CREATE OR REPLACE FUNCTION public.get_all_tables()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT table_name::text
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
$$;

-- Function to get columns for a specific table
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
RETURNS TABLE (column_name text, data_type text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT column_name::text, data_type::text
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = $1
  ORDER BY ordinal_position;
$$;
