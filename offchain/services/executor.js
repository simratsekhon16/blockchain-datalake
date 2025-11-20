const { getSchema, saveAuditLog, saveIngestionFile, saveQueryResults } = require('./minio');
const { executeQuery } = require('./trino');
const { getContract } = require('./chain');

/**
 * Handle ingestion approval event
 */
async function handleIngestionApproved(proposalId, datasetId, metadataJson) {
  console.log('\n--- Processing Ingestion Approval ---');
  
  try {
    // Parse metadata
    const metadata = JSON.parse(metadataJson);
    console.log('Parsed metadata:', metadata);

    // Validate schema
    const schema = await getSchema(datasetId);
    if (!schema) {
      throw new Error(`No schema found for dataset ${datasetId}`);
    }

    // Validate columns match schema
    if (metadata.expected_columns) {
      const schemaColumns = schema.columns.map(c => c.name);
      const invalidColumns = metadata.expected_columns.filter(
        col => !schemaColumns.includes(col)
      );
      
      if (invalidColumns.length > 0) {
        throw new Error(`Invalid columns: ${invalidColumns.join(', ')}`);
      }
    }

    // Create audit log
    const auditData = {
      proposalId: proposalId.toString(),
      datasetId: datasetId.toString(),
      metadata,
      status: 'approved',
      timestamp: new Date().toISOString(),
      schema_validated: true
    };

    await saveAuditLog('ingestion', datasetId, proposalId, auditData);
    console.log('Ingestion approval processed successfully');
    console.log('Ready for file upload. Use registerIngest() after uploading file.');

  } catch (error) {
    console.error('Error processing ingestion approval:', error);
    
    // Log error to audit
    const errorAudit = {
      proposalId: proposalId.toString(),
      datasetId: datasetId.toString(),
      error: error.message,
      status: 'failed',
      timestamp: new Date().toISOString()
    };
    
    await saveAuditLog('ingestion-error', datasetId, proposalId, errorAudit);
    throw error;
  }
}

/**
 * Handle access granted event
 */
async function handleAccessGranted(proposalId, datasetId, grantee, metadataJson) {
  console.log('\n--- Processing Access Grant ---');
  
  try {
    // Parse metadata
    const metadata = JSON.parse(metadataJson);
    console.log('Parsed metadata:', metadata);

    // Get dataset schema
    const schema = await getSchema(datasetId);
    if (!schema) {
      throw new Error(`No schema found for dataset ${datasetId}`);
    }

    // Validate columns
    const schemaColumns = schema.columns.map(c => c.name);
    const invalidColumns = metadata.columns.filter(col => !schemaColumns.includes(col));
    
    if (invalidColumns.length > 0) {
      throw new Error(`Invalid columns requested: ${invalidColumns.join(', ')}`);
    }

    // Parse and validate row filter
    const rowFilter = metadata.row_filter || '';
    const limit = metadata.limit || 10000;

    // Construct SQL query
    const sql = constructSQL(datasetId, metadata.columns, rowFilter, limit);
    console.log('Generated SQL:', sql);

    // Execute query via Trino
    console.log('Executing query via Trino...');
    const results = await executeQuery(sql);
    console.log(`Query executed successfully, ${results.length} bytes returned`);

    // Save results to MinIO
    const resultPath = await saveQueryResults(datasetId, proposalId, results);
    console.log(`Results saved to: ${resultPath}`);

    // Create audit log
    const auditData = {
      proposalId: proposalId.toString(),
      datasetId: datasetId.toString(),
      grantee,
      metadata,
      sql,
      resultPath,
      status: 'completed',
      timestamp: new Date().toISOString()
    };

    await saveAuditLog('query', datasetId, proposalId, auditData);
    console.log('Query access processed successfully');

  } catch (error) {
    console.error('Error processing access grant:', error);
    
    // Log error to audit
    const errorAudit = {
      proposalId: proposalId.toString(),
      datasetId: datasetId.toString(),
      grantee,
      error: error.message,
      status: 'failed',
      timestamp: new Date().toISOString()
    };
    
    await saveAuditLog('query-error', datasetId, proposalId, errorAudit);
    throw error;
  }
}

/**
 * Construct SQL query from metadata
 */
function constructSQL(datasetId, columns, rowFilter, limit) {
  // Sanitize column names
  const sanitizedColumns = columns.map(col => 
    col.replace(/[^a-zA-Z0-9_]/g, '')
  ).join(', ');

  // Basic SQL construction
  let sql = `SELECT ${sanitizedColumns}\nFROM hive.default.dataset_${datasetId}`;

  // Add WHERE clause if filter exists
  if (rowFilter && rowFilter.trim().length > 0) {
    // Basic sanitization - in production, use proper SQL parser
    const sanitizedFilter = rowFilter
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
    
    sql += `\nWHERE ${sanitizedFilter}`;
  }

  // Add LIMIT
  sql += `\nLIMIT ${parseInt(limit)}`;

  return sql;
}

/**
 * Validate row filter syntax
 */
function validateRowFilter(filter) {
  // Disallowed patterns
  const disallowed = [
    /DROP/i,
    /DELETE/i,
    /INSERT/i,
    /UPDATE/i,
    /CREATE/i,
    /ALTER/i,
    /TRUNCATE/i,
    /EXEC/i,
    /EXECUTE/i,
    /SELECT.*FROM/i,  // Nested queries
    /UNION/i,
    /JOIN/i
  ];

  for (const pattern of disallowed) {
    if (pattern.test(filter)) {
      throw new Error(`Invalid filter: contains disallowed pattern ${pattern}`);
    }
  }

  return true;
}

module.exports = {
  handleIngestionApproved,
  handleAccessGranted,
  constructSQL,
  validateRowFilter
};
