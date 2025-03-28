import psycopg2
import os
from dotenv import load_dotenv
from tabulate import tabulate

# Load environment variables
load_dotenv()

# Database connection parameters
conn_string = os.getenv("DATABASE_URL")

def check_table_structure():
    """Check the structure of the job_costs_actual_monthly table"""
    try:
        # Connect to the database
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Get table structure
        cursor.execute("""
            SELECT 
                column_name, 
                data_type,
                is_nullable
            FROM 
                information_schema.columns 
            WHERE 
                table_schema = 'public' 
                AND table_name = 'job_costs_actual_monthly'
            ORDER BY 
                ordinal_position;
        """)
        
        columns = cursor.fetchall()
        print("Table Structure:")
        print(tabulate(columns, headers=["Column Name", "Data Type", "Nullable"]))
        
        # Check if table has data
        cursor.execute("""
            SELECT COUNT(*) FROM job_costs_actual_monthly;
        """)
        count = cursor.fetchone()[0]
        print(f"\nTotal rows in job_costs_actual_monthly: {count}")
        
        # Get sample data if available
        if count > 0:
            cursor.execute("""
                SELECT * FROM job_costs_actual_monthly LIMIT 5;
            """)
            sample_data = cursor.fetchall()
            column_names = [desc[0] for desc in cursor.description]
            print("\nSample Data:")
            print(tabulate(sample_data, headers=column_names))
        else:
            print("\nNo data found in the table.")
            
            # Check if there's a view or materialized view with similar name
            cursor.execute("""
                SELECT table_name, table_type 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE '%actual%monthly%';
            """)
            similar_tables = cursor.fetchall()
            if similar_tables:
                print("\nSimilar tables/views found:")
                print(tabulate(similar_tables, headers=["Table Name", "Type"]))
        
        # Close cursor and connection
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error checking table structure: {e}")

def check_source_data():
    """Check if there's source data that should be in this table"""
    try:
        # Connect to the database
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Check job_costs table for monthly data
        cursor.execute("""
            SELECT 
                date_trunc('month', date) as month,
                COUNT(*) as record_count,
                SUM(CASE WHEN amount IS NOT NULL THEN 1 ELSE 0 END) as records_with_amount
            FROM 
                job_costs
            GROUP BY 
                date_trunc('month', date)
            ORDER BY 
                month DESC
            LIMIT 12;
        """)
        
        monthly_data = cursor.fetchall()
        print("\nMonthly Data in job_costs table:")
        print(tabulate(monthly_data, headers=["Month", "Record Count", "Records with Amount"]))
        
        # Close cursor and connection
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error checking source data: {e}")

if __name__ == "__main__":
    print("Checking job_costs_actual_monthly table...")
    check_table_structure()
    print("\n" + "="*50 + "\n")
    print("Checking source data...")
    check_source_data()
