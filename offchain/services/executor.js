const { getSchema, saveAuditLog, saveIngestionFile, saveQueryResults } = require('./minio');
const { executeQuery } = require('./trino');
const { getContract } = require('./chain');

/**
 * Handle ingestion approval event
 */
async function handleIngestionApproved(event) {
    const { proposalId, datasetId } = event.args;
    
    console.log(`\n=== Ingestion Approved ===`);
    console.log(`Proposal ID: ${proposalId}`);
    console.log(`Dataset ID: ${datasetId}`);
    
    try {
        // Get proposal details
        const proposal = await contract.getProposal(proposalId);
        const metadata = JSON.parse(proposal[4]);
        
        console.log('Metadata:', metadata);
        
        // Validate schema
        const dataset = await contract.getDataset(datasetId);
        const schemaJson = dataset[1];
        
        // If file was uploaded to temp location, move it
        if (metadata.tempPath) {
            console.log(`Moving file from temp: ${metadata.tempPath}`);
            
            const finalPath = `datasets/${datasetId}/ingestion/${proposalId}/${metadata.filename}`;
            
            // Copy from temp to final location
            await moveFileToFinal(metadata.tempPath, finalPath);
            
            console.log(`File moved to: ${finalPath}`);
            
            // Create Trino table if needed
            await createTrinoTable(datasetId, schemaJson, finalPath);
            
            // Save audit log
            await saveAuditLog('ingestion', datasetId, proposalId, {
                filename: metadata.filename,
                format: metadata.format,
                purpose: metadata.purpose,
                finalPath: finalPath,
                fileSize: metadata.fileSize,
                columns: metadata.fileColumns,
                rows: metadata.fileRows,
                approvedAt: new Date().toISOString()
            });
            
            console.log('✓ Ingestion processing complete');
        } else {
            console.log('No file attached to this proposal');
        }
        
    } catch (error) {
        console.error('Error processing ingestion:', error);
    }
}
// Move file from temp to final location in MinIO
async function moveFileToFinal(tempPath, finalPath) {
    try {
        // Copy object to new location
        await minioClient.copyObject(
            'datalake',           // destination bucket
            finalPath,            // destination path
            `datalake/${tempPath}` // source
        );
        
        console.log(`Copied: ${tempPath} → ${finalPath}`);
        
        // Delete temp file
        await minioClient.removeObject('datalake', tempPath);
        
        console.log(`Deleted temp: ${tempPath}`);
        
    } catch (error) {
        console.error('Failed to move file:', error);
        throw error;
    }
}

// Clean up temporary file (if proposal creation fails)
app.post('/cleanup-temp', async (req, res) => {
    try {
        const { path } = req.body;
        
        if (!path) {
            return res.status(400).json({ error: 'Path required' });
        }
        
        console.log(`Cleaning up temp file: ${path}`);
        
        await minioClient.removeObject('datalake', path);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ 
            error: 'Cleanup failed',
            message: error.message
        });
    }
});
// Clean up temp files older than 24 hours
async function cleanupOldTempFiles() {
    try {
        const prefix = 'temp-uploads/';
        const stream = minioClient.listObjects('datalake', prefix, true);
        
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for await (const obj of stream) {
            const fileAge = now - new Date(obj.lastModified).getTime();
            
            if (fileAge > maxAge) {
                console.log(`Deleting old temp file: ${obj.name}`);
                await minioClient.removeObject('datalake', obj.name);
            }
        }
        
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// Run cleanup every hour
setInterval(cleanupOldTempFiles, 60 * 60 * 1000);
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
