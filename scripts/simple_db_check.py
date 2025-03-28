import psycopg2
import os
from dotenv import load_dotenv
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.env_config import get_db_connection_string

def check_database_tables():
    # Get database connection string from environment
    connection_string = get_db_connection_string()
    
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
        print("-" * 80)
        print(f"{'Table Name':<30} {'Records':<10} {'Columns':<10} {'Has Data':<10}")
        print("-" * 80)
        
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
            
            # Print table info
            print(f"{table_name:<30} {count:<10} {column_count:<10} {'Yes' if count > 0 else 'No':<10}")
            
            # If table has data, get column names and a sample row
            if count > 0:
                # Get column names
                cursor.execute(f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = '{table_name}'
                    ORDER BY ordinal_position
                    LIMIT 5
                """)
                columns = [col[0] for col in cursor.fetchall()]
                
                # Get a sample row
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 1")
                sample = cursor.fetchone()
                
                # Print column names and sample data
                print(f"  Key columns: {', '.join(columns)}...")
                print(f"  Sample data: {str(sample)[:100]}...")
                print()
        
        print("-" * 80)
        print("\nDetailed view of tables with data:")
        print("-" * 80)
        
        # For tables with data, show more details
        for table in tables:
            table_name = table[0]
            
            # Get record count
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            
            if count > 0:
                print(f"\nTable: {table_name} ({count} records)")
                
                # Get all columns
                cursor.execute(f"""
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = '{table_name}'
                    ORDER BY ordinal_position
                """)
                columns = cursor.fetchall()
                
                print("Columns:")
                for col_name, col_type in columns:
                    print(f"  {col_name} ({col_type})")
                
                # For numeric columns, show some statistics
                numeric_columns = [col[0] for col in columns if col[1] in ('numeric', 'decimal', 'integer', 'bigint')]
                
                if numeric_columns:
                    print("\nNumeric column statistics:")
                    for col in numeric_columns[:5]:  # Limit to first 5 numeric columns
                        try:
                            cursor.execute(f"SELECT MIN({col}), MAX({col}), AVG({col}) FROM {table_name} WHERE {col} IS NOT NULL")
                            min_val, max_val, avg_val = cursor.fetchone()
                            print(f"  {col}: Min={min_val}, Max={max_val}, Avg={avg_val}")
                        except:
                            print(f"  {col}: Could not calculate statistics")
                
                print("-" * 80)
        
        # Close connection
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error checking database tables: {e}")

if __name__ == "__main__":
    check_database_tables()
