# Job Costs Data Dashboard

A web-based dashboard for visualizing and analyzing job costs data from multiple spreadsheets.

## Project Structure

- `/public`: Frontend files (HTML, CSS, JavaScript)
- `/scripts`: Python scripts for importing data from spreadsheets
- `/data`: Directory for storing data spreadsheets
- `/src`: Source code for additional features

## Features

- Interactive dashboard with overview statistics
- Data tables for viewing all job costs data
- Charts and visualizations for revenue, costs, and profits
- Filtering and search capabilities
- Export data to CSV

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Python (v3.8 or higher)
- PostgreSQL database (using Supabase)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd datadashboard
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with your database connection string:
   ```
   DATABASE_URL=postgresql://postgres:yourpassword@db.yourinstance.supabase.co:5432/postgres
   PORT=3000
   ```

4. Install Python dependencies for data import scripts:
   ```
   pip install pandas psycopg2-binary openpyxl
   ```

### Importing Data

1. Place your Excel spreadsheets in the `/data` directory

2. Run the import scripts to load data into the database:
   ```
   cd scripts
   python import_job_costs_fixed.py
   python extract_remaining_sheets.py
   ```

### Running the Dashboard

1. Start the server:
   ```
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Database Structure

The dashboard uses the following tables:

- `job_costs`: Main job costs data
- `job_costs_summary`: Summary statistics
- `job_costs_paul_vincent`: Data filtered by sales rep
- `job_costs_scott_w`: Data filtered by sales rep
- And other tables for different sheets from the Excel file

## Development

To run the server in development mode with auto-restart:

```
npm run dev
```
