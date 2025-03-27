// Global variables
let currentTable = 'job_costs';
let currentPage = 0;
let pageSize = 100;
let totalRecords = 0;
let allTables = [];
let tableData = {};
let currentSection = 'overview';

// API base URL - change based on environment
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? '' // Empty for local development
    : '/.netlify/functions/api';

// DOM elements
const loadingElement = document.getElementById('loading');
const overviewSection = document.getElementById('overview-section');
const dataTablesSection = document.getElementById('data-tables-section');
const analyticsSection = document.getElementById('analytics-section');
const tablesDropdownMenu = document.getElementById('tables-dropdown-menu');
const currentTableTitle = document.getElementById('current-table-title');
const dataTableHeader = document.getElementById('data-table-header');
const dataTableBody = document.getElementById('data-table-body');
const tablePaginationInfo = document.getElementById('table-pagination-info');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const tableSearch = document.getElementById('table-search');
const exportCsvButton = document.getElementById('export-csv');

// Navigation links
const overviewLink = document.getElementById('overview-link');
const analyticsLink = document.getElementById('analytics-link');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch available tables
        await fetchTables();
        
        // Fetch initial data for overview
        await fetchOverviewData();
        
        // Set up event listeners
        setupEventListeners();
        
        // Hide loading indicator
        loadingElement.classList.add('d-none');
        
        // Show overview section by default
        showSection('overview');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        loadingElement.innerHTML = `<div class="alert alert-danger">Error loading dashboard data. Please try refreshing the page.</div>`;
    }
});

// Fetch available tables from the API
async function fetchTables() {
    const response = await fetch(`${API_BASE_URL}/tables`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const tables = await response.json();
    allTables = tables.map(t => t.table_name);
    
    // Populate tables dropdown
    tablesDropdownMenu.innerHTML = '';
    allTables.forEach(table => {
        const displayName = formatTableName(table);
        const li = document.createElement('li');
        li.innerHTML = `<a class="dropdown-item" href="#" data-table="${table}">${displayName}</a>`;
        tablesDropdownMenu.appendChild(li);
    });
}

// Format table name for display
function formatTableName(tableName) {
    // Remove job_costs_ prefix and replace underscores with spaces
    let name = tableName.replace('job_costs_', '');
    // Capitalize words
    name = name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    if (tableName === 'job_costs') {
        return 'Main Data';
    }
    
    return name;
}

// Fetch data for overview section
async function fetchOverviewData() {
    // Fetch main job costs data
    const response = await fetch(`${API_BASE_URL}/data/job_costs?limit=1000`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    const data = result.data;
    
    // Calculate overview statistics
    updateOverviewStats(data);
    
    // Populate recent jobs table
    populateRecentJobs(data);
    
    // Create charts
    createSalesRepChart(data);
    createMonthlyRevenueChart(data);
}

// Update overview statistics
function updateOverviewStats(data) {
    // Total jobs
    document.getElementById('total-jobs').textContent = data.length;
    
    // Total revenue
    const totalRevenue = data.reduce((sum, job) => {
        const invoiceTotal = parseFloat(job.invoice_total || 0);
        return sum + (isNaN(invoiceTotal) ? 0 : invoiceTotal);
    }, 0);
    document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);
    
    // Average profit
    const profits = data.filter(job => job.profit !== null && !isNaN(parseFloat(job.profit)));
    const avgProfit = profits.length > 0 
        ? profits.reduce((sum, job) => sum + parseFloat(job.profit || 0), 0) / profits.length 
        : 0;
    document.getElementById('avg-profit').textContent = formatCurrency(avgProfit);
    
    // Completion rate
    const completedJobs = data.filter(job => job.construction_status?.toLowerCase() === 'completed').length;
    const completionRate = data.length > 0 ? (completedJobs / data.length) * 100 : 0;
    document.getElementById('completion-rate').textContent = `${completionRate.toFixed(1)}%`;
}

// Populate recent jobs table
function populateRecentJobs(data) {
    const recentJobsTable = document.getElementById('recent-jobs-table');
    
    // Sort by invoice date (newest first)
    const sortedJobs = [...data].sort((a, b) => {
        const dateA = a.invoice_date ? new Date(a.invoice_date) : new Date(0);
        const dateB = b.invoice_date ? new Date(b.invoice_date) : new Date(0);
        return dateB - dateA;
    });
    
    // Take the 10 most recent jobs
    const recentJobs = sortedJobs.slice(0, 10);
    
    // Create table rows
    recentJobsTable.innerHTML = '';
    recentJobs.forEach(job => {
        const row = document.createElement('tr');
        
        // Format the status class
        let statusClass = 'status-signed';
        if (job.construction_status?.toLowerCase() === 'completed') {
            statusClass = 'status-completed';
        } else if (job.construction_status?.toLowerCase().includes('progress')) {
            statusClass = 'status-inprogress';
        }
        
        row.innerHTML = `
            <td>${job.invoice_number || '-'}</td>
            <td>${formatDate(job.invoice_date) || '-'}</td>
            <td>${job.customer_name || '-'}</td>
            <td>${job.sales_rep || '-'}</td>
            <td>${formatCurrency(job.invoice_total) || '-'}</td>
            <td><span class="${statusClass}">${job.construction_status || 'Unknown'}</span></td>
        `;
        recentJobsTable.appendChild(row);
    });
}

// Create sales rep chart
function createSalesRepChart(data) {
    // Group data by sales rep
    const salesRepData = {};
    data.forEach(job => {
        const rep = job.sales_rep || 'Unknown';
        const amount = parseFloat(job.invoice_total || 0);
        
        if (!isNaN(amount)) {
            if (!salesRepData[rep]) {
                salesRepData[rep] = 0;
            }
            salesRepData[rep] += amount;
        }
    });
    
    // Sort by revenue (descending)
    const sortedReps = Object.keys(salesRepData).sort((a, b) => salesRepData[b] - salesRepData[a]);
    
    // Create chart data
    const labels = sortedReps;
    const values = sortedReps.map(rep => salesRepData[rep]);
    
    // Create chart
    const ctx = document.getElementById('sales-rep-chart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: values,
                backgroundColor: 'rgba(67, 97, 238, 0.7)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.raw.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Create monthly revenue chart
function createMonthlyRevenueChart(data) {
    // Group data by month
    const monthlyData = {};
    data.forEach(job => {
        if (!job.invoice_date) return;
        
        const date = new Date(job.invoice_date);
        const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const amount = parseFloat(job.invoice_total || 0);
        
        if (!isNaN(amount)) {
            if (!monthlyData[month]) {
                monthlyData[month] = 0;
            }
            monthlyData[month] += amount;
        }
    });
    
    // Sort by month
    const sortedMonths = Object.keys(monthlyData).sort();
    
    // Create chart data
    const labels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return `${monthNum}/${year.slice(2)}`;
    });
    const values = sortedMonths.map(month => monthlyData[month]);
    
    // Create chart
    const ctx = document.getElementById('monthly-revenue-chart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: values,
                backgroundColor: 'rgba(76, 201, 240, 0.2)',
                borderColor: 'rgba(76, 201, 240, 1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.raw.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Fetch data for a specific table
async function fetchTableData(table, page = 0, limit = pageSize) {
    const offset = page * limit;
    const response = await fetch(`${API_BASE_URL}/data/${table}?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    tableData = result;
    totalRecords = result.total;
    
    // Update pagination info
    const start = offset + 1;
    const end = Math.min(offset + limit, totalRecords);
    tablePaginationInfo.textContent = `Showing ${start}-${end} of ${totalRecords}`;
    
    // Update pagination buttons
    prevPageButton.disabled = page === 0;
    nextPageButton.disabled = end >= totalRecords;
    
    // Fetch columns for the table
    const columnsResponse = await fetch(`${API_BASE_URL}/columns/${table}`);
    if (!columnsResponse.ok) {
        throw new Error(`HTTP error! status: ${columnsResponse.status}`);
    }
    
    const columns = await columnsResponse.json();
    
    // Populate table header
    populateTableHeader(columns);
    
    // Populate table body
    populateTableBody(result.data, columns);
    
    // Update table title
    currentTableTitle.textContent = formatTableName(table);
}

// Populate table header
function populateTableHeader(columns) {
    const headerRow = document.createElement('tr');
    
    columns.forEach(column => {
        if (column.column_name === 'id') return; // Skip id column
        
        const th = document.createElement('th');
        th.textContent = formatColumnName(column.column_name);
        headerRow.appendChild(th);
    });
    
    dataTableHeader.innerHTML = '';
    dataTableHeader.appendChild(headerRow);
}

// Format column name for display
function formatColumnName(columnName) {
    // Replace underscores with spaces and capitalize words
    return columnName.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Populate table body
function populateTableBody(data, columns) {
    dataTableBody.innerHTML = '';
    
    if (data.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = columns.length;
        emptyCell.textContent = 'No data available';
        emptyCell.className = 'text-center py-3';
        emptyRow.appendChild(emptyCell);
        dataTableBody.appendChild(emptyRow);
        return;
    }
    
    data.forEach(row => {
        const tableRow = document.createElement('tr');
        
        columns.forEach(column => {
            if (column.column_name === 'id') return; // Skip id column
            
            const cell = document.createElement('td');
            const value = row[column.column_name];
            
            // Format cell value based on data type
            if (value === null || value === undefined) {
                cell.textContent = '-';
            } else if (column.data_type === 'numeric' || column.data_type.includes('decimal')) {
                if (column.column_name.includes('total') || 
                    column.column_name.includes('amount') || 
                    column.column_name.includes('cost') || 
                    column.column_name.includes('profit')) {
                    cell.textContent = formatCurrency(value);
                } else if (column.column_name.includes('percent')) {
                    cell.textContent = `${parseFloat(value).toFixed(1)}%`;
                } else {
                    cell.textContent = parseFloat(value).toLocaleString();
                }
            } else if (column.data_type === 'date') {
                cell.textContent = formatDate(value);
            } else if (column.column_name === 'construction_status' || column.column_name === 'payment_status') {
                let statusClass = 'status-signed';
                if (value?.toLowerCase() === 'completed') {
                    statusClass = 'status-completed';
                } else if (value?.toLowerCase().includes('progress')) {
                    statusClass = 'status-inprogress';
                }
                cell.innerHTML = `<span class="${statusClass}">${value}</span>`;
            } else {
                cell.textContent = value;
            }
            
            tableRow.appendChild(cell);
        });
        
        dataTableBody.appendChild(tableRow);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Navigation links
    overviewLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('overview');
    });
    
    analyticsLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('analytics');
    });
    
    // Table dropdown items
    tablesDropdownMenu.addEventListener('click', async (e) => {
        e.preventDefault();
        if (e.target.classList.contains('dropdown-item')) {
            const table = e.target.getAttribute('data-table');
            currentTable = table;
            currentPage = 0;
            showSection('data-tables');
            await fetchTableData(table);
        }
    });
    
    // Pagination buttons
    prevPageButton.addEventListener('click', async () => {
        if (currentPage > 0) {
            currentPage--;
            await fetchTableData(currentTable, currentPage);
        }
    });
    
    nextPageButton.addEventListener('click', async () => {
        if ((currentPage + 1) * pageSize < totalRecords) {
            currentPage++;
            await fetchTableData(currentTable, currentPage);
        }
    });
    
    // Table search
    tableSearch.addEventListener('input', debounce(async () => {
        // TODO: Implement search functionality
        console.log('Search:', tableSearch.value);
    }, 300));
    
    // Export CSV
    exportCsvButton.addEventListener('click', () => {
        exportTableToCSV(currentTable);
    });
    
    // Analytics controls
    document.getElementById('metric-select').addEventListener('change', updatePerformanceChart);
    document.getElementById('dimension-select').addEventListener('change', updatePerformanceChart);
    document.getElementById('date-range').addEventListener('change', updatePerformanceChart);
}

// Show the selected section
function showSection(section) {
    currentSection = section;
    
    // Hide all sections
    overviewSection.classList.add('d-none');
    dataTablesSection.classList.add('d-none');
    analyticsSection.classList.add('d-none');
    
    // Show selected section
    if (section === 'overview') {
        overviewSection.classList.remove('d-none');
        overviewLink.classList.add('active');
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link !== overviewLink) link.classList.remove('active');
        });
    } else if (section === 'data-tables') {
        dataTablesSection.classList.remove('d-none');
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    } else if (section === 'analytics') {
        analyticsSection.classList.remove('d-none');
        analyticsLink.classList.add('active');
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link !== analyticsLink) link.classList.remove('active');
        });
        
        // Initialize analytics charts if they don't exist yet
        initializeAnalyticsCharts();
    }
}

// Initialize analytics charts
function initializeAnalyticsCharts() {
    // TODO: Implement analytics charts
    console.log('Initializing analytics charts');
}

// Update performance chart based on selected options
function updatePerformanceChart() {
    // TODO: Implement performance chart update
    console.log('Updating performance chart');
}

// Export table to CSV
function exportTableToCSV(table) {
    // TODO: Implement CSV export
    console.log('Exporting table to CSV:', table);
}

// Helper function to format currency
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(parseFloat(value))) {
        return '-';
    }
    
    return '$' + parseFloat(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    });
}

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
