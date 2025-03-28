import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv
import re

# Load environment variables
load_dotenv()

# Database connection parameters
conn_string = os.getenv("DATABASE_URL")

def clean_column_name(name):
    """Clean column name to be SQL-safe"""
    # Replace special characters and spaces with underscores
    clean_name = re.sub(r'[^a-zA-Z0-9]', '_', str(name).lower())
    # Remove consecutive underscores
    clean_name = re.sub(r'_+', '_', clean_name)
    # Remove leading/trailing underscores
    clean_name = clean_name.strip('_')
    # Ensure it doesn't start with a number
    if clean_name and clean_name[0].isdigit():
        clean_name = 'col_' + clean_name
    # If empty, use a default name
    if not clean_name:
        clean_name = 'column'
    return clean_name

def import_monthly_expenses():
    """Import the Monthly Expenses data from Excel to the database"""
    try:
        # Path to the Excel file
        excel_file = "./data/03 Monthly Expenses Transfer.xlsx"
        
        print(f"Reading monthly expenses from {excel_file}...")
        
        # List all sheets in the file
        xls = pd.ExcelFile(excel_file)
        sheets = xls.sheet_names
        print(f"Found sheets: {', '.join(sheets)}")
        
        # Create a simple structure for the monthly data
        # We'll create a standardized format regardless of the Excel structure
        monthly_data = []
        
        for sheet_name in sheets:
            print(f"Reading sheet: {sheet_name}")
            
            # Read the Excel sheet
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            
            # Skip empty sheets
            if df.empty:
                print(f"Sheet {sheet_name} is empty. Skipping.")
                continue
            
            # Extract the month from the sheet name
            month = sheet_name
            
            # Find expense items and amounts
            # This is a simplified approach - in a real scenario, we'd need to analyze the structure more carefully
            for i in range(len(df)):
                row = df.iloc[i]
                
                # Look for rows that might contain expense items
                for j in range(len(row)):
                    item_value = row.iloc[j]
                    if pd.notna(item_value) and isinstance(item_value, str) and len(item_value) > 2:
                        # Check if the next column might be an amount
                        if j+1 < len(row) and pd.notna(row.iloc[j+1]):
                            try:
                                amount = float(row.iloc[j+1])
                                # This looks like an expense item with an amount
                                monthly_data.append({
                                    'month': month,
                                    'expense_item': item_value,
                                    'amount': amount,
                                    'category': 'Unknown'  # Default category
                                })
                            except (ValueError, TypeError):
                                # Not a numeric amount, skip
                                pass
        
        # Convert to DataFrame
        if not monthly_data:
            print("No expense data found in the sheets.")
            return False
            
        expenses_df = pd.DataFrame(monthly_data)
        print(f"\nExtracted {len(expenses_df)} expense items across all months")
        print(expenses_df.head())
        
        # Connect to the database
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()
        
        # Drop the existing table if it exists
        cursor.execute("DROP TABLE IF EXISTS job_costs_actual_monthly")
        
        # Create a standardized table structure
        cursor.execute("""
        CREATE TABLE job_costs_actual_monthly (
            id SERIAL PRIMARY KEY,
            month TEXT,
            expense_item TEXT,
            amount NUMERIC,
            category TEXT
        );
        """)
        
        # Prepare data for insertion
        data = expenses_df.replace({pd.NA: None}).to_dict('records')
        
        # Insert data
        execute_values(
            cursor, 
            "INSERT INTO job_costs_actual_monthly (month, expense_item, amount, category) VALUES %s",
            [(item['month'], item['expense_item'], item['amount'], item['category']) for item in data]
        )
        
        # Commit and close
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"\nSuccessfully imported {len(expenses_df)} rows into job_costs_actual_monthly table")
        return True
        
    except Exception as e:
        print(f"Error importing monthly expenses: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import_monthly_expenses()
