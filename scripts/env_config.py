import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database connection string from environment variables
def get_db_connection_string():
    """Get database connection string from environment variables"""
    conn_string = os.getenv("DATABASE_URL")
    if not conn_string:
        raise ValueError("DATABASE_URL environment variable is not set")
    return conn_string
