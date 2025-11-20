const Minio = require('minio');
const fs = require('fs');
const path = require('path');

// MinIO client configuration
const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin'
});

// Bucket names
const BUCKETS = {
  DATASETS: 'datasets',
  SCHEMAS: 'schemas',
  RESULTS: 'datalake-results',
  AUDIT: 'audit'
};

/**
 * Initialize MinIO buckets
 */
async function initializeMinIO() {
  console.log('Initializing MinIO buckets...');
  
  for (const [name, bucket] of Object.entries(BUCKETS)) {
    try {
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket, 'us-east-1');
        console.log(`Created bucket: ${bucket}`);
      } else {
        console.log(`Bucket already exists: ${bucket}`);
      }
    } catch (error) {
      console.error(`Error with bucket ${bucket}:`, error.message);
      throw error;
    }
  }
  
  console.log('MinIO initialization complete');
}

/**
 * Upload file to MinIO
 */
async function uploadFile(bucket, objectName, filePath) {
  try {
    const metaData = {
      'Content-Type': 'application/octet-stream',
    };
    
    await minioClient.fPutObject(bucket, objectName, filePath, metaData);
    console.log(`Uploaded ${objectName} to ${bucket}`);
    return true;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Upload buffer to MinIO
 */
async function uploadBuffer(bucket, objectName, buffer, contentType = 'application/json') {
  try {
    const metaData = {
      'Content-Type': contentType,
    };
    
    await minioClient.putObject(bucket, objectName, buffer, buffer.length, metaData);
    console.log(`Uploaded buffer to ${bucket}/${objectName}`);
    return true;
  } catch (error) {
    console.error('Error uploading buffer:', error);
    throw error;
  }
}

/**
 * Get file from MinIO
 */
async function getFile(bucket, objectName) {
  try {
    const dataStream = await minioClient.getObject(bucket, objectName);
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      dataStream.on('data', (chunk) => chunks.push(chunk));
      dataStream.on('end', () => resolve(Buffer.concat(chunks)));
      dataStream.on('error', reject);
    });
  } catch (error) {
    console.error('Error getting file:', error);
    throw error;
  }
}

/**
 * Get schema for a dataset
 */
async function getSchema(datasetId) {
  try {
    const schemaPath = `${datasetId}.json`;
    const buffer = await getFile(BUCKETS.SCHEMAS, schemaPath);
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

/**
 * Save schema for a dataset
 */
async function saveSchema(datasetId, schema) {
  try {
    const schemaPath = `${datasetId}.json`;
    const buffer = Buffer.from(JSON.stringify(schema, null, 2));
    await uploadBuffer(BUCKETS.SCHEMAS, schemaPath, buffer, 'application/json');
    console.log(`Schema saved for dataset ${datasetId}`);
    return true;
  } catch (error) {
    console.error('Error saving schema:', error);
    throw error;
  }
}

/**
 * Save ingestion file
 */
async function saveIngestionFile(datasetId, fileName, filePath) {
  try {
    const timestamp = Date.now();
    const objectName = `${datasetId}/raw/${timestamp}/${fileName}`;
    await uploadFile(BUCKETS.DATASETS, objectName, filePath);
    return objectName;
  } catch (error) {
    console.error('Error saving ingestion file:', error);
    throw error;
  }
}

/**
 * Save audit log
 */
async function saveAuditLog(type, datasetId, proposalId, data) {
  try {
    const timestamp = Date.now();
    const objectName = `${type}/dataset-${datasetId}-proposal-${proposalId}-${timestamp}.json`;
    const buffer = Buffer.from(JSON.stringify(data, null, 2));
    await uploadBuffer(BUCKETS.AUDIT, objectName, buffer, 'application/json');
    console.log(`Audit log saved: ${objectName}`);
    return objectName;
  } catch (error) {
    console.error('Error saving audit log:', error);
    throw error;
  }
}

/**
 * Save query results
 */
async function saveQueryResults(datasetId, proposalId, results) {
  try {
    const timestamp = Date.now();
    const objectName = `dataset-${datasetId}/proposal-${proposalId}-${timestamp}.csv`;
    const buffer = Buffer.from(results);
    await uploadBuffer(BUCKETS.RESULTS, objectName, buffer, 'text/csv');
    console.log(`Query results saved: ${objectName}`);
    return objectName;
  } catch (error) {
    console.error('Error saving query results:', error);
    throw error;
  }
}

/**
 * List files in a bucket
 */
async function listFiles(bucket, prefix = '') {
  return new Promise((resolve, reject) => {
    const files = [];
    const stream = minioClient.listObjects(bucket, prefix, true);
    
    stream.on('data', (obj) => files.push(obj));
    stream.on('end', () => resolve(files));
    stream.on('error', reject);
  });
}

module.exports = {
  minioClient,
  BUCKETS,
  initializeMinIO,
  uploadFile,
  uploadBuffer,
  getFile,
  getSchema,
  saveSchema,
  saveIngestionFile,
  saveAuditLog,
  saveQueryResults,
  listFiles
};
