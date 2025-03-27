import psycopg2
import pandas as pd
from tabulate import tabulate

def check_database_tables():
    # Direct connection string
    connection_string = "postgresql://postgres:Yitbos88@db.kdhwrlhzevzekoanusbs.supabase.co:5432/postgres"
    
    try:
        # Connect to database
        print(f"Connecting to database with direct connection string...")
        conn = psycopg2.connect(connection_string)
        
        # Query to get all job_costs tables
        query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name LIKE 'job_costs%'
            ORDER BY table_name
        """
        
        # Use pandas to read the query results
        tables_df = pd.read_sql(query, conn)
        table_names = tables_df['table_name'].tolist()
        
        print(f"\nFound {len(table_names)} job_costs tables:")
        
        # Create a summary dataframe
        summary_data = []
        
        for table_name in table_names:
            # Get record count
            count_query = f"SELECT COUNT(*) FROM {table_name}"
            count = pd.read_sql(count_query, conn).iloc[0, 0]
            
            # Get column information
            columns_query = f"""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = '{table_name}'
                ORDER BY ordinal_position
            """
            columns_df = pd.read_sql(columns_query, conn)
            
            # Get sample data if table has records
            sample_data = None
            if count > 0:
                sample_query = f"SELECT * FROM {table_name} LIMIT 3"
                sample_data = pd.read_sql(sample_query, conn)
            
            # Add to summary data
            summary_data.append({
                'table_name': table_name,
                'record_count': count,
                'column_count': len(columns_df),
                'columns': ', '.join(columns_df['column_name'].head(5).tolist()) + ('...' if len(columns_df) > 5 else ''),
                'data_types': ', '.join(columns_df['data_type'].head(5).tolist()) + ('...' if len(columns_df) > 5 else ''),
                'has_data': 'Yes' if count > 0 else 'No'
            })
        
        # Create summary dataframe
        summary_df = pd.DataFrame(summary_data)
        
        # Print summary table
        print("\nDatabase Tables Summary:")
        print(tabulate(summary_df, headers='keys', tablefmt='grid', showindex=False))
        
        # Print more detailed information for tables with data
        print("\nDetailed Information for Tables with Data:")
        for table_name in table_names:
            count_query = f"SELECT COUNT(*) FROM {table_name}"
            count = pd.read_sql(count_query, conn).iloc[0, 0]
            
            if count > 0:
                print(f"\n{table_name} ({count} records):")
                
                # Get column statistics for numeric columns
                columns_query = f"""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = '{table_name}'
                    AND data_type IN ('numeric', 'decimal', 'integer', 'bigint', 'real', 'double precision')
                """
                numeric_columns = pd.read_sql(columns_query, conn)['column_name'].tolist()
                
                if numeric_columns:
                    stats_query = f"SELECT "
                    for col in numeric_columns[:5]:  # Limit to first 5 numeric columns
                        stats_query += f"AVG({col}) as {col}_avg, MIN({col}) as {col}_min, MAX({col}) as {col}_max, "
                    stats_query = stats_query.rstrip(', ')
                    stats_query += f" FROM {table_name}"
                    
                    try:
                        stats_df = pd.read_sql(stats_query, conn)
                        print("Numeric Column Statistics:")
                        for col in numeric_columns[:5]:
                            print(f"  {col}: Avg={stats_df[f'{col}_avg'].iloc[0]}, Min={stats_df[f'{col}_min'].iloc[0]}, Max={stats_df[f'{col}_max'].iloc[0]}")
                    except:
                        print("  Could not calculate statistics for numeric columns")
                
                # Get sample data
                sample_query = f"SELECT * FROM {table_name} LIMIT 3"
                sample_df = pd.read_sql(sample_query, conn)
                print("\nSample Data (first 3 rows):")
                print(sample_df.head(3).to_string())
                print("\n" + "-"*80)
        
        # Close connection
        conn.close()
        
    except Exception as e:
        print(f"Error checking database tables: {e}")

if __name__ == "__main__":
    try:
        import tabulate
    except ImportError:
        print("Installing tabulate package...")
        import subprocess
        subprocess.check_call(["pip", "install", "tabulate"])
    
    check_database_tables()
