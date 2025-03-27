import csv
import json
import pandas as pd
import psycopg2
import psycopg2.extras
import datetime
import re

# Function to clean up dollar values
def clean_dollar(value):
    if pd.isna(value):
        return None
    if isinstance(value, str):
        # Handle negative dollar values like -$949.05
        if value.startswith('-$'):
            return -float(value.replace('-$', '').replace(',', ''))
        # Handle regular dollar values
        elif value.startswith('$'):
            return float(value.replace('$', '').replace(',', ''))
    return value

# Function to clean up percentage values
def clean_percent(value):
    if pd.isna(value):
        return None
    if isinstance(value, str):
        if value.endswith('%'):
            # Remove % and convert to float
            return float(value.replace('%', ''))
    return value

# Function to convert date strings to proper format
def convert_date(date_str):
    if pd.isna(date_str) or date_str == '#N/A':
        return None
    try:
        # Try to parse the date (assuming MM/DD/YY format)
        date_obj = datetime.datetime.strptime(date_str, '%m/%d/%y')
        return date_obj.strftime('%Y-%m-%d')
    except:
        return None

# Function to clean column names for SQL
def clean_column_name(name):
    # Replace spaces with underscores and remove special characters
    clean_name = re.sub(r'[^a-zA-Z0-9_]', '', name.replace(' ', '_').replace('%', 'percent'))
    # Make lowercase
    clean_name = clean_name.lower()
    # Ensure it doesn't start with a number
    if clean_name and clean_name[0].isdigit():
        clean_name = 'col_' + clean_name
    return clean_name

# Load the TSV file
print("Loading TSV file...")
df = pd.read_csv(r"C:\Users\info\Downloads\01 Job Costs 2025 (2) - Data.tsv", sep='\t')

# Clean up the data
print("Cleaning data...")
# Create a mapping of original column names to clean column names
column_mapping = {col: clean_column_name(col) for col in df.columns}
df = df.rename(columns=column_mapping)

# Process specific column types
for col in df.columns:
    if 'amount' in col or 'total' in col or 'cost' in col or 'profit' in col:
        df[col] = df[col].apply(clean_dollar)
    elif 'percent' in col or col.endswith('_percent') or col.endswith('percent'):
        df[col] = df[col].apply(clean_percent)
    elif 'date' in col:
        df[col] = df[col].apply(convert_date)

# Special handling for columns that contain percentage values but don't have "percent" in their name
for col in df.columns:
    # Check a sample of non-null values to see if they contain % symbol
    sample = df[col].dropna().head(5)
    if len(sample) > 0 and any(isinstance(val, str) and '%' in val for val in sample):
        print(f"Detected percentage column: {col}")
        df[col] = df[col].apply(clean_percent)

# Special handling for columns that contain dollar values but don't have standard naming
for col in df.columns:
    # Check a sample of non-null values to see if they contain $ symbol
    sample = df[col].dropna().head(5)
    if len(sample) > 0 and any(isinstance(val, str) and ('$' in val) for val in sample):
        print(f"Detected dollar column: {col}")
        df[col] = df[col].apply(clean_dollar)

# Replace #N/A with None
df = df.replace('#N/A', None)

# Convert to list of dictionaries for easier database insertion
job_costs = df.to_dict('records')

print(f"Processed {len(job_costs)} job cost records")

# Save to JSON file as backup
with open('job_costs.json', 'w') as f:
    json.dump(job_costs, f, indent=2, default=str)
print("Saved backup to job_costs.json")

# Connect to database
print("Connecting to database...")
try:
    # Use the correct connection string
    connection_string = "postgresql://postgres:Yitbos88@db.kdhwrlhzevzekoanusbs.supabase.co:5432/postgres"
    conn = psycopg2.connect(connection_string)
    cursor = conn.cursor()
    
    # Check if table exists, if not create it
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'job_costs'
        )
    """)
    table_exists = cursor.fetchone()[0]
    
    if table_exists:
        # If table exists, drop it to start fresh
        print("Table already exists, dropping and recreating...")
        cursor.execute("DROP TABLE job_costs")
        conn.commit()
    
    print("Creating job_costs table...")
    # Create columns based on the TSV structure
    columns = []
    for original_col, clean_col in column_mapping.items():
        # Determine column type based on data
        if 'date' in clean_col:
            col_type = 'DATE'
        elif 'amount' in clean_col or 'total' in clean_col or 'cost' in clean_col or 'profit' in clean_col:
            col_type = 'DECIMAL(15,2)'
        elif 'percent' in clean_col:
            # Use a larger precision for percentage values to handle large percentages
            col_type = 'DECIMAL(15,2)'
        else:
            col_type = 'TEXT'
        
        columns.append(f"{clean_col} {col_type}")
    
    # Create the table
    create_table_sql = f"CREATE TABLE job_costs (id SERIAL PRIMARY KEY, {', '.join(columns)})"
    cursor.execute(create_table_sql)
    conn.commit()
    print("Table created successfully")
    
    # Insert data into the table
    print("Inserting data into job_costs table...")
    success_count = 0
    error_count = 0
    
    for job in job_costs:
        try:
            # Filter out None values and prepare column names and values
            columns = []
            values = []
            
            for key, value in job.items():
                if value is not None:  # Only include non-None values
                    columns.append(key)
                    values.append(value)
            
            # Skip if no valid values
            if not columns:
                continue
            
            # Build the insert query with placeholders
            placeholders = ["%s"] * len(columns)
            insert_sql = f"INSERT INTO job_costs ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
            
            # Execute the insert
            cursor.execute(insert_sql, values)
            success_count += 1
            
        except Exception as e:
            error_count += 1
            print(f"Error inserting record: {e}")
            # Continue with next record instead of failing completely
            continue
    
    conn.commit()
    print(f"Data insertion complete: {success_count} records inserted, {error_count} errors")
    
    # Verify the data
    cursor.execute("SELECT COUNT(*) FROM job_costs")
    count = cursor.fetchone()[0]
    print(f"Verified {count} records in database")
    
    # Close the connection
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Database error: {e}")

print("Import complete!")
