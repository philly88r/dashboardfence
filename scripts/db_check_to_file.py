import psycopg2
import os

def check_database_tables():
    # Direct connection string
    connection_string = "postgresql://postgres:Yitbos88@db.kdhwrlhzevzekoanusbs.supabase.co:5432/postgres"
    
    # Output file path
    output_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database_report.txt")
    
    try:
        # Connect to database
        print(f"Connecting to database with direct connection string...")
        conn = psycopg2.connect(connection_string)
        cursor = conn.cursor()
        
        with open(output_file, 'w') as f:
            f.write("DATABASE TABLES REPORT\n")
            f.write("=====================\n\n")
            
            # Query to get all job_costs tables
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name LIKE 'job_costs%'
                ORDER BY table_name
            """)
            
            tables = cursor.fetchall()
            
            f.write(f"Found {len(tables)} job_costs tables:\n")
            f.write("-" * 80 + "\n")
            f.write(f"{'Table Name':<30} {'Records':<10} {'Columns':<10} {'Has Data':<10}\n")
            f.write("-" * 80 + "\n")
            
            for table in tables:
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
                
                # Write table info
                f.write(f"{table_name:<30} {count:<10} {column_count:<10} {'Yes' if count > 0 else 'No':<10}\n")
                
                # If table has data, get column names
                if count > 0:
                    # Get column names
                    cursor.execute(f"""
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                        AND table_name = '{table_name}'
                        ORDER BY ordinal_position
                        LIMIT 10
                    """)
                    columns = [col[0] for col in cursor.fetchall()]
                    
                    # Write column names
                    f.write(f"  Key columns: {', '.join(columns)}\n")
                    f.write("\n")
            
            f.write("-" * 80 + "\n")
            f.write("\nDETAILED VIEW OF TABLES WITH DATA:\n")
            f.write("-" * 80 + "\n")
            
            # For tables with data, show more details
            for table in tables:
                table_name = table[0]
                
                # Get record count
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                
                if count > 0:
                    f.write(f"\nTable: {table_name} ({count} records)\n")
                    
                    # Get all columns
                    cursor.execute(f"""
                        SELECT column_name, data_type
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                        AND table_name = '{table_name}'
                        ORDER BY ordinal_position
                    """)
                    columns = cursor.fetchall()
                    
                    f.write("Columns:\n")
                    for col_name, col_type in columns:
                        f.write(f"  {col_name} ({col_type})\n")
                    
                    # For numeric columns, show some statistics
                    numeric_columns = [col[0] for col in columns if col[1] in ('numeric', 'decimal', 'integer', 'bigint')]
                    
                    if numeric_columns:
                        f.write("\nNumeric column statistics:\n")
                        for col in numeric_columns[:5]:  # Limit to first 5 numeric columns
                            try:
                                cursor.execute(f"SELECT MIN({col}), MAX({col}), AVG({col}) FROM {table_name} WHERE {col} IS NOT NULL")
                                min_val, max_val, avg_val = cursor.fetchone()
                                f.write(f"  {col}: Min={min_val}, Max={max_val}, Avg={avg_val}\n")
                            except Exception as e:
                                f.write(f"  {col}: Could not calculate statistics ({str(e)})\n")
                    
                    f.write("-" * 80 + "\n")
        
        # Close connection
        cursor.close()
        conn.close()
        
        print(f"Database report written to: {output_file}")
        
    except Exception as e:
        print(f"Error checking database tables: {e}")

if __name__ == "__main__":
    check_database_tables()
