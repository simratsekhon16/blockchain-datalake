const { setupEventListeners } = require('./services/chain');
const { initializeMinIO } = require('./services/minio');
const express = require('express');

const app = express();
const PORT = 3001;

async function main() {
  console.log('Starting Blockchain Data Lake Off-Chain Services...');

  try {
    // Initialize MinIO
    console.log('Initializing MinIO...');
    await initializeMinIO();
    console.log('MinIO initialized successfully');

    // Setup blockchain event listeners
    console.log('Setting up blockchain event listeners...');
    await setupEventListeners();
    console.log('Event listeners active');

    // Start REST API for status/health checks
    app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        service: 'blockchain-datalake-offchain',
        timestamp: new Date().toISOString()
      });
    });

    app.listen(PORT, () => {
      console.log(`Off-chain service API running on port ${PORT}`);
      console.log('Listening for blockchain events...');
    });

  } catch (error) {
    console.error('Failed to start off-chain services:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});
// Upload to temporary location
app.post('/upload-temp', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded' 
            });
        }
        
        const { datasetId, metadata } = req.body;
        
        if (!datasetId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing datasetId' 
            });
        }
        
        console.log(`Temp upload started: ${req.file.originalname} for dataset ${datasetId}`);
        
        // Generate temporary path
        const timestamp = Date.now();
        const tempPath = `temp-uploads/${datasetId}/${timestamp}-${req.file.originalname}`;
        
        // Read file
        const fileContent = await fs.readFile(req.file.path);
        
        // Upload to MinIO temporary location
        await minioClient.putObject(
            'datalake',
            tempPath,
            fileContent,
            {
                'Content-Type': req.file.mimetype,
                'X-Dataset-Id': datasetId.toString(),
                'X-Temp-Upload': 'true',
                'X-Original-Name': req.file.originalname
            }
        );
        
        console.log(`File uploaded to temp: ${tempPath}`);
        
        // Clean up local temp file
        await fs.unlink(req.file.path);
        
        res.json({
            success: true,
            path: tempPath,
            filename: req.file.originalname,
            size: req.file.size
        });
        
    } catch (error) {
        console.error('Temp upload error:', error);
        
        // Clean up on error
        if (req.file && req.file.path) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        
        res.status(500).json({
            success: false,
            error: 'Upload failed',
            message: error.message
        });
    }
});

main();
