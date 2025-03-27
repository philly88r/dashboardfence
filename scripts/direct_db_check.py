import psycopg2

def check_database_tables():
    # Direct connection string
    connection_string = "postgresql://postgres:Yitbos88@db.kdhwrlhzevzekoanusbs.supabase.co:5432/postgres"
    
    try:
        # Connect to database
        print(f"Connecting to database with direct connection string...")
        conn = psycopg2.connect(connection_string)
        cursor = conn.cursor()
        
        # Query to get all job_costs tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name LIKE 'job_costs%'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        
        print(f"\nFound {len(tables)} job_costs tables:")
        for i, table in enumerate(tables, 1):
            table_name = table[0]
            
            # Get record count for each table
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            
            # Get column count for each table
            cursor.execute(f"""
                SELECT COUNT(*) 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = '{table_name}'
            """)
            column_count = cursor.fetchone()[0]
            
            print(f"{i}. {table_name}: {count} records, {column_count} columns")
            
            # Get sample data from each table (first 3 rows)
            if count > 0:
                cursor.execute(f"""
                    SELECT * FROM {table_name} LIMIT 3
                """)
                sample_data = cursor.fetchall()
                
                # Get column names
                cursor.execute(f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = '{table_name}'
                    ORDER BY ordinal_position
                """)
                columns = [col[0] for col in cursor.fetchall()]
                
                print(f"   Sample columns: {', '.join(columns[:5])}{'...' if len(columns) > 5 else ''}")
                print(f"   First row preview: {str(sample_data[0])[:100]}..." if sample_data else "   No data")
                print()
        
        # Close connection
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error checking database tables: {e}")

if __name__ == "__main__":
    check_database_tables()
