const fetch = require('node-fetch');

// Trino configuration
const TRINO_CONFIG = {
  host: 'localhost',
  port: 8080,
  catalog: 'hive',
  schema: 'default',
  user: 'admin'
};

/**
 * Execute SQL query via Trino
 */
async function executeQuery(sql) {
  console.log('Executing Trino query...');
  
  try {
    const url = `http://${TRINO_CONFIG.host}:${TRINO_CONFIG.port}/v1/statement`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-Trino-User': TRINO_CONFIG.user,
        'X-Trino-Catalog': TRINO_CONFIG.catalog,
        'X-Trino-Schema': TRINO_CONFIG.schema
      },
      body: sql
    });

    if (!response.ok) {
      throw new Error(`Trino query failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Query submitted to Trino');

    // Poll for results
    const finalResult = await pollQueryResults(result.nextUri);
    
    // Convert results to CSV
    const csv = convertToCSV(finalResult);
    return csv;

  } catch (error) {
    console.error('Trino query execution error:', error);
    throw error;
  }
}

/**
 * Poll Trino for query results
 */
async function pollQueryResults(uri) {
  let currentUri = uri;
  let finalData = null;

  while (currentUri) {
    const response = await fetch(currentUri, {
      headers: {
        'X-Trino-User': TRINO_CONFIG.user
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch query results: ${response.status}`);
    }

    const data = await response.json();

    // Check for errors
    if (data.error) {
      throw new Error(`Trino query error: ${data.error.message}`);
    }

    // Store data if available
    if (data.data) {
      finalData = {
        columns: data.columns,
        data: data.data
      };
    }

    // Check if query is complete
    if (data.stats.state === 'FINISHED') {
      console.log('Query completed successfully');
      return finalData;
    }

    if (data.stats.state === 'FAILED') {
      throw new Error('Query failed');
    }

    // Continue polling
    currentUri = data.nextUri;
    
    // Small delay to avoid hammering the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return finalData;
}

/**
 * Convert Trino results to CSV format
 */
function convertToCSV(result) {
  if (!result || !result.data) {
    return '';
  }

  const lines = [];

  // Add header
  const header = result.columns.map(col => col.name).join(',');
  lines.push(header);

  // Add data rows
  for (const row of result.data) {
    const csvRow = row.map(cell => {
      // Handle null values
      if (cell === null) return '';
      
      // Quote strings that contain commas or quotes
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      
      return cell;
    }).join(',');
    
    lines.push(csvRow);
  }

  return lines.join('\n');
}

/**
 * Test Trino connection
 */
async function testConnection() {
  try {
    const url = `http://${TRINO_CONFIG.host}:${TRINO_CONFIG.port}/v1/info`;
    const response = await fetch(url);
    
    if (response.ok) {
      const info = await response.json();
      console.log('Trino connection successful');
      console.log('Version:', info.nodeVersion.version);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Trino connection test failed:', error.message);
    return false;
  }
}

/**
 * Create table in Trino for a dataset
 */
async function createDatasetTable(datasetId, schema) {
  console.log(`Creating Trino table for dataset ${datasetId}`);
  
  // Build column definitions
  const columnDefs = schema.columns.map(col => {
    let trinoType = 'VARCHAR';
    
    switch (col.type.toUpperCase()) {
      case 'INT':
      case 'INTEGER':
        trinoType = 'INTEGER';
        break;
      case 'BIGINT':
      case 'LONG':
        trinoType = 'BIGINT';
        break;
      case 'DOUBLE':
      case 'FLOAT':
        trinoType = 'DOUBLE';
        break;
      case 'BOOLEAN':
      case 'BOOL':
        trinoType = 'BOOLEAN';
        break;
      case 'DATE':
        trinoType = 'DATE';
        break;
      case 'TIMESTAMP':
        trinoType = 'TIMESTAMP';
        break;
      default:
        trinoType = 'VARCHAR';
    }
    
    return `${col.name} ${trinoType}`;
  }).join(',\n  ');

  const createTableSQL = `
CREATE TABLE IF NOT EXISTS hive.default.dataset_${datasetId} (
  ${columnDefs}
)
WITH (
  format = 'PARQUET',
  external_location = 's3a://datasets/${datasetId}/raw/'
)
`;

  try {
    await executeQuery(createTableSQL);
    console.log(`Table created for dataset ${datasetId}`);
    return true;
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}

module.exports = {
  executeQuery,
  testConnection,
  createDatasetTable,
  pollQueryResults,
  convertToCSV,
  TRINO_CONFIG
};
