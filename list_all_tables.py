import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# Supabase configuration
SUPABASE_URL = "https://kdhwrlhzevzekoanusbs.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_KEY:
    SUPABASE_KEY = input("Enter your Supabase anon key: ")

def list_all_tables():
    """List all tables in the Supabase database"""
    
    # Use the REST API to query information_schema.tables
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # First attempt: Try using the REST API with a direct SQL query
    sql_query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/execute_sql",
        headers=headers,
        json={"sql": sql_query}
    )
    
    if response.status_code == 200:
        try:
            tables = [row[0] for row in response.json()]
            return tables
        except (json.JSONDecodeError, KeyError, IndexError):
            print("Could not parse response from execute_sql")
    
    # Second attempt: Try using the REST API to query pg_catalog.pg_tables
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/pg_catalog.pg_tables?select=tablename&schemaname=eq.public",
        headers=headers
    )
    
    if response.status_code == 200:
        try:
            tables = [item["tablename"] for item in response.json()]
            return tables
        except (json.JSONDecodeError, KeyError):
            print("Could not parse response from pg_catalog.pg_tables")
    
    # Third attempt: Try a simpler approach by listing all tables that we can access
    tables = []
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/",
        headers=headers
    )
    
    if response.status_code == 200:
        try:
            # The response might contain table definitions
            tables = list(response.json().keys())
            return tables
        except (json.JSONDecodeError, AttributeError):
            print("Could not parse response from root endpoint")
    
    # If all attempts fail, return an empty list
    return []

if __name__ == "__main__":
    print("Listing all tables in Supabase database...")
    tables = list_all_tables()
    
    if tables:
        print(f"Found {len(tables)} tables:")
        for i, table in enumerate(tables, 1):
            print(f"{i}. {table}")
    else:
        print("No tables found or could not access the database.")
        print("Make sure your SUPABASE_ANON_KEY is correct and has the necessary permissions.")
