import pandas as pd
import os
import sys
import psycopg2
import json
import re
import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def clean_column_name(name):
    """Clean column names for SQL"""
    if pd.isna(name):
        return "unnamed_column"
    # Replace spaces with underscores and remove special characters
    clean_name = re.sub(r'[^a-zA-Z0-9_]', '', str(name).replace(' ', '_').replace('%', 'percent'))
    # Make lowercase
    clean_name = clean_name.lower()
    # Ensure it doesn't start with a number
    if clean_name and clean_name[0].isdigit():
        clean_name = 'col_' + clean_name
    return clean_name

def extract_and_import_sheets(excel_file_path, output_dir, connection_string, skip_sheets=None):
    """
    Extract sheets from Excel file and import them to database
    
    Args:
        excel_file_path: Path to Excel file
        output_dir: Directory to save TSV files
        connection_string: Database connection string
        skip_sheets: List of sheet names to skip
    """
    if skip_sheets is None:
        skip_sheets = []
    
    if not os.path.exists(excel_file_path):
        print(f"Error: File not found - {excel_file_path}")
        return False
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Get base filename
    base_filename = os.path.splitext(os.path.basename(excel_file_path))[0]
    
    # Read Excel file
    print(f"Reading Excel file: {excel_file_path}")
    excel_file = pd.ExcelFile(excel_file_path)
    sheet_names = excel_file.sheet_names
    
    # Filter out sheets to skip
    sheets_to_process = [sheet for sheet in sheet_names if sheet not in skip_sheets]
    print(f"Processing {len(sheets_to_process)} sheets: {', '.join(sheets_to_process)}")
    
    # Connect to database
    conn = psycopg2.connect(connection_string)
    
    # Process each sheet
    for sheet_name in sheets_to_process:
        try:
            print(f"\nProcessing sheet: {sheet_name}")
            
            # Read sheet data
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            
            # Skip empty sheets
            if df.empty:
                print(f"Sheet {sheet_name} is empty, skipping")
                continue
            
            # Clean column names
            df.columns = [clean_column_name(col) for col in df.columns]
            
            # Save as TSV
            safe_sheet_name = sheet_name.replace('/', '_').replace('\\', '_').replace('?', '_').replace('*', '_').replace(':', '_')
            tsv_path = os.path.join(output_dir, f"{base_filename} - {safe_sheet_name}.tsv")
            df.to_csv(tsv_path, sep='\t', index=False)
            print(f"Saved to: {tsv_path}")
            
            # Create table name from sheet name
            table_name = f"job_costs_{clean_column_name(sheet_name)}"
            
            # Create database table
            cursor = conn.cursor()
            
            # Check if table exists
            cursor.execute(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table_name}'
                )
            """)
            table_exists = cursor.fetchone()[0]
            
            if table_exists:
                print(f"Table {table_name} already exists, dropping...")
                cursor.execute(f"DROP TABLE {table_name}")
                conn.commit()
            
            # Create table columns
            columns = []
            for col in df.columns:
                # Determine column type based on data
                sample = df[col].dropna().head(1)
                if len(sample) > 0:
                    sample_val = sample.iloc[0]
                    if isinstance(sample_val, (datetime.date, pd.Timestamp)):
                        col_type = "DATE"
                    elif isinstance(sample_val, (int, float)):
                        col_type = "DECIMAL(15,2)"
                    else:
                        col_type = "TEXT"
                else:
                    col_type = "TEXT"
                
                columns.append(f"{col} {col_type}")
            
            # Create table
            create_table_sql = f"CREATE TABLE {table_name} (id SERIAL PRIMARY KEY, {', '.join(columns)})"
            cursor.execute(create_table_sql)
            conn.commit()
            print(f"Created table: {table_name}")
            
            # Insert data
            print("Inserting data...")
            records = df.to_dict('records')
            success_count = 0
            error_count = 0
            
            for record in records:
                try:
                    # Filter out None values
                    columns = []
                    values = []
                    
                    for key, value in record.items():
                        if pd.notna(value):  # Only include non-NA values
                            columns.append(key)
                            # Convert pandas Timestamp to datetime
                            if isinstance(value, pd.Timestamp):
                                value = value.to_pydatetime()
                            values.append(value)
                    
                    # Skip if no valid values
                    if not columns:
                        continue
                    
                    # Build insert query
                    placeholders = ["%s"] * len(columns)
                    insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
                    
                    # Execute insert
                    cursor.execute(insert_sql, values)
                    success_count += 1
                    
                except Exception as e:
                    error_count += 1
                    print(f"Error inserting record: {e}")
                    continue
            
            conn.commit()
            print(f"Data insertion complete: {success_count} records inserted, {error_count} errors")
            
            # Verify data
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            print(f"Verified {count} records in {table_name}")
            
        except Exception as e:
            print(f"Error processing sheet {sheet_name}: {e}")
    
    # Close connection
    conn.close()
    print("\nAll sheets processed successfully!")
    return True

if __name__ == "__main__":
    # Get connection string from environment variable
    connection_string = os.getenv("DATABASE_URL")
    
    # Project root directory
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Excel file path
    excel_file_path = os.path.join(project_root, "data", "01 Job Costs 2025 (2).xlsx")
    
    # Output directory for TSV files
    output_dir = os.path.join(project_root, "data", "tsv_exports")
    
    # Skip the Data sheet since we've already imported it
    skip_sheets = ["Data"]
    
    print(f"Project root: {project_root}")
    print(f"Excel file path: {excel_file_path}")
    print(f"Output directory: {output_dir}")
    print(f"Database connection: {connection_string}")
    
    # Extract and import sheets
    extract_and_import_sheets(excel_file_path, output_dir, connection_string, skip_sheets)
