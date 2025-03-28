import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection parameters
conn_string = os.getenv("DATABASE_URL")

def list_all_tables():
    """List all tables in the PostgreSQL database"""
    try:
        # Connect to the database
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Query to get all tables in the public schema
        cursor.execute("""
            SELECT 
                table_name
            FROM 
                information_schema.tables
            WHERE 
                table_schema = 'public'
            ORDER BY 
                table_name;
        """)
        
        # Fetch all results
        tables = cursor.fetchall()
        
        # Close cursor and connection
        cursor.close()
        conn.close()
        
        # Return table names as a list
        return [table[0] for table in tables]
        
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return []

if __name__ == "__main__":
    print("Listing all tables in the PostgreSQL database...")
    tables = list_all_tables()
    
    if tables:
        print(f"Found {len(tables)} tables:")
        for i, table in enumerate(tables, 1):
            print(f"{i}. {table}")
    else:
        print("No tables found or could not access the database.")
