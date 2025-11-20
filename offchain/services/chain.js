const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { handleIngestionApproved } = require('./executor');
const { handleAccessGranted } = require('./executor');

let contract;
let provider;

/**
 * Setup blockchain connection and event listeners
 */
async function setupEventListeners() {
  // Load contract ABI and address
  const contractData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'abi', 'DataLakeAccess.json'), 'utf8')
  );

  // Connect to Hardhat local network
  provider = new ethers.WebSocketProvider('ws://127.0.0.1:8545');
  
  // Create contract instance
  contract = new ethers.Contract(
    contractData.address,
    contractData.abi,
    provider
  );

  console.log('Connected to contract at:', contractData.address);

  // Listen for IngestionApproved events
  contract.on('IngestionApproved', async (proposalId, datasetId, metadata, timestamp, event) => {
    console.log('\n=== INGESTION APPROVED EVENT ===');
    console.log('Proposal ID:', proposalId.toString());
    console.log('Dataset ID:', datasetId.toString());
    console.log('Metadata:', metadata);
    console.log('Timestamp:', new Date(Number(timestamp) * 1000).toISOString());
    
    try {
      await handleIngestionApproved(proposalId, datasetId, metadata);
    } catch (error) {
      console.error('Error handling ingestion approval:', error);
    }
  });

  // Listen for ColumnRowAccessGranted events
  contract.on('ColumnRowAccessGranted', async (proposalId, datasetId, grantee, metadata, timestamp, event) => {
    console.log('\n=== COLUMN/ROW ACCESS GRANTED EVENT ===');
    console.log('Proposal ID:', proposalId.toString());
    console.log('Dataset ID:', datasetId.toString());
    console.log('Grantee:', grantee);
    console.log('Metadata:', metadata);
    console.log('Timestamp:', new Date(Number(timestamp) * 1000).toISOString());
    
    try {
      await handleAccessGranted(proposalId, datasetId, grantee, metadata);
    } catch (error) {
      console.error('Error handling access grant:', error);
    }
  });

  // Listen for DatasetCreated events
  contract.on('DatasetCreated', (datasetId, name, creator, timestamp, event) => {
    console.log('\n=== DATASET CREATED EVENT ===');
    console.log('Dataset ID:', datasetId.toString());
    console.log('Name:', name);
    console.log('Creator:', creator);
    console.log('Timestamp:', new Date(Number(timestamp) * 1000).toISOString());
  });

  // Listen for ProposalCreated events
  contract.on('ProposalCreated', (proposalId, proposalType, datasetId, proposer, metadata, timestamp, event) => {
    console.log('\n=== PROPOSAL CREATED EVENT ===');
    console.log('Proposal ID:', proposalId.toString());
    console.log('Type:', proposalType);
    console.log('Dataset ID:', datasetId.toString());
    console.log('Proposer:', proposer);
  });

  // Listen for IngestionRegistered events
  contract.on('IngestionRegistered', (ingestionId, datasetId, storagePath, ingestor, timestamp, event) => {
    console.log('\n=== INGESTION REGISTERED EVENT ===');
    console.log('Ingestion ID:', ingestionId.toString());
    console.log('Dataset ID:', datasetId.toString());
    console.log('Storage Path:', storagePath);
    console.log('Ingestor:', ingestor);
    console.log('Timestamp:', new Date(Number(timestamp) * 1000).toISOString());
  });

  console.log('Event listeners registered successfully');
}

/**
 * Get contract instance
 */
function getContract() {
  return contract;
}

/**
 * Get provider instance
 */
function getProvider() {
  return provider;
}

module.exports = {
  setupEventListeners,
  getContract,
  getProvider
};
