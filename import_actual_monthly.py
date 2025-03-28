import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv
import sys
import glob

# Load environment variables
load_dotenv()

# Database connection parameters
conn_string = os.getenv("DATABASE_URL")

def find_excel_files(directory='.'):
    """Find all Excel files in the directory"""
    excel_files = glob.glob(f"{directory}/**/*.xlsx", recursive=True)
    excel_files.extend(glob.glob(f"{directory}/**/*.xls", recursive=True))
    return excel_files

def list_sheets(excel_file):
    """List all sheets in an Excel file"""
    try:
        xls = pd.ExcelFile(excel_file)
        return xls.sheet_names
    except Exception as e:
        print(f"Error reading {excel_file}: {e}")
        return []

def import_sheet_to_db(excel_file, sheet_name):
    """Import a specific sheet from an Excel file to the database"""
    try:
        print(f"Reading sheet '{sheet_name}' from {excel_file}...")
        
        # Read the Excel sheet
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        
        # Clean up column names
        df.columns = [str(col).lower().replace(' ', '_').replace('-', '_').replace('/', '_').replace('\\', '_') for col in df.columns]
        
        # Check if this is the actual monthly sheet
        is_actual_monthly = any(name in sheet_name.lower() for name in ['actual', 'monthly']) or any(col for col in df.columns if 'actual' in str(col).lower() and 'month' in str(col).lower())
        
        if not is_actual_monthly:
            print(f"Sheet '{sheet_name}' doesn't appear to be the actual monthly data. Skipping.")
            return False
        
        print(f"Found actual monthly data in sheet '{sheet_name}'")
        print(f"Columns: {', '.join(df.columns)}")
        print(f"Data shape: {df.shape}")
        
        # Connect to the database
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Drop the existing table if it exists
        cursor.execute("DROP TABLE IF EXISTS job_costs_actual_monthly")
        
        # Create table dynamically based on DataFrame columns
        create_table_sql = "CREATE TABLE job_costs_actual_monthly ("
        
        # Add an id column as primary key
        create_table_sql += "id SERIAL PRIMARY KEY,"
        
        # Add columns based on DataFrame
        for col in df.columns:
            # Determine column type based on DataFrame dtype
            if pd.api.types.is_numeric_dtype(df[col]):
                if all(isinstance(x, int) or pd.isna(x) for x in df[col]):
                    col_type = "INTEGER"
                else:
                    col_type = "NUMERIC"
            elif pd.api.types.is_datetime64_dtype(df[col]):
                col_type = "DATE"
            else:
                col_type = "TEXT"
                
            create_table_sql += f"\n    {col} {col_type},"
            
        # Remove the trailing comma and close the statement
        create_table_sql = create_table_sql.rstrip(',') + "\n);"
        
        print("Creating table with schema:")
        print(create_table_sql)
        
        # Execute the create table statement
        cursor.execute(create_table_sql)
        
        # Prepare data for insertion
        data = df.replace({pd.NA: None}).to_dict('records')
        
        # Generate the INSERT statement
        columns = df.columns
        insert_sql = f"INSERT INTO job_costs_actual_monthly ({', '.join(columns)}) VALUES %s"
        
        # Convert data to list of tuples for execute_values
        values = [[row[col] for col in columns] for row in data]
        
        # Insert data
        execute_values(cursor, insert_sql, values)
        
        # Commit and close
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"Successfully imported {len(df)} rows into job_costs_actual_monthly table")
        return True
        
    except Exception as e:
        print(f"Error importing sheet: {e}")
        return False

def main():
    # Find Excel files
    excel_files = find_excel_files('.')
    if not excel_files:
        excel_files = find_excel_files('./data')
    
    if not excel_files:
        print("No Excel files found. Please place Excel files in the current directory or a 'data' subdirectory.")
        return
    
    print(f"Found {len(excel_files)} Excel files:")
    for i, file in enumerate(excel_files, 1):
        print(f"{i}. {file}")
    
    # Process each Excel file
    for excel_file in excel_files:
        sheets = list_sheets(excel_file)
        print(f"\nFile: {excel_file}")
        print(f"Contains {len(sheets)} sheets: {', '.join(sheets)}")
        
        # Try to find sheets that might contain actual monthly data
        potential_sheets = [sheet for sheet in sheets if any(term in sheet.lower() for term in ['actual', 'monthly'])]
        
        if potential_sheets:
            print(f"Found potential actual monthly sheets: {', '.join(potential_sheets)}")
            for sheet in potential_sheets:
                if import_sheet_to_db(excel_file, sheet):
                    print(f"Successfully imported '{sheet}' as job_costs_actual_monthly")
                    return
        else:
            # If no obvious sheet names, try all sheets
            print("No obvious actual monthly sheets found. Trying all sheets...")
            for sheet in sheets:
                if import_sheet_to_db(excel_file, sheet):
                    print(f"Successfully imported '{sheet}' as job_costs_actual_monthly")
                    return
    
    print("Could not find or import actual monthly data from any sheet.")

if __name__ == "__main__":
    main()
