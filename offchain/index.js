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

main();
