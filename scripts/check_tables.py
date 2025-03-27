import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_database_tables():
    # Get connection string from environment variable
    connection_string = os.getenv("DATABASE_URL")
    
    if not connection_string:
        print("Error: DATABASE_URL environment variable not found")
        return
    
    try:
        # Connect to database
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
        
        print(f"Found {len(tables)} job_costs tables:")
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
        
        # Close connection
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error checking database tables: {e}")

if __name__ == "__main__":
    check_database_tables()
