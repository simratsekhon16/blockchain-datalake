
// Global variables
let provider;
let signer;
let contract;
let currentAccount;
let contractData;

// Contract ABI and address will be loaded dynamically
const loadContractData = async () => {
    try {
        const response = await fetch('abi/DataLakeAccess.json');
        contractData = await response.json();
        return contractData;
    } catch (error) {
        console.error('Failed to load contract data:', error);
        showError('Failed to load contract data. Make sure the contract is deployed.');
        return null;
    }
};

// Initialize the application
async function init() {
    console.log('Initializing application...');
    
    // Load contract data
    const data = await loadContractData();
    if (!data) return;

    // Setup event listeners
    setupEventListeners();
    
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
        console.log('MetaMask is installed');
        
        // Check if already connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    } else {
        showError('MetaMask is not installed. Please install MetaMask to use this application.');
    }
}

// Connect to MetaMask wallet
async function connectWallet() {
    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Setup provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        currentAccount = accounts[0];
        
        // Setup contract
        contract = new ethers.Contract(contractData.address, contractData.abi, signer);
        
        // Update UI
        document.getElementById('account-address').textContent = 
            `${currentAccount.substring(0, 6)}...${currentAccount.substring(38)}`;
        document.getElementById('connect-wallet').textContent = 'Connected';
        document.getElementById('connect-wallet').disabled = true;
        
        console.log('Connected to:', currentAccount);
        
        // Load initial data
        await loadDatasets();
        await loadProposals();
        
        // Setup contract event listeners
        setupContractEventListeners();
        
        showSuccess('Wallet connected successfully!');
        
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        showError('Failed to connect wallet: ' + error.message);
    }
}

// Setup UI event listeners
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    // Connect wallet button
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
    
    // Create dataset form
    document.getElementById('create-dataset-form').addEventListener('submit', handleCreateDataset);
    document.getElementById('add-column').addEventListener('click', addSchemaColumn);
    
    // Proposal type selector
    document.getElementById('proposal-type').addEventListener('change', handleProposalTypeChange);
    document.getElementById('proposal-dataset').addEventListener('change', handleDatasetChange);
    
    // Submit proposal
    document.getElementById('submit-proposal').addEventListener('click', handleSubmitProposal);
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterProposals(btn.dataset.filter);
        });
    });
    
    // Add filter button
    document.getElementById('add-filter').addEventListener('click', addFilterRow);
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });
    
    // Clear logs
    document.getElementById('clear-logs').addEventListener('click', () => {
        document.getElementById('event-logs').innerHTML = '<p class="info">No events logged yet</p>';
    });
    
    // Refresh logs
    document.getElementById('refresh-logs').addEventListener('click', () => {
        showSuccess('Logs refreshed');
    });
}

// Switch between tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Load datasets from contract
async function loadDatasets() {
    if (!contract) return;
    
    const datasetsList = document.getElementById('datasets-list');
    datasetsList.innerHTML = '<p class="loading">Loading datasets...</p>';
    
    try {
        const datasetCount = await contract.datasetCount();
        console.log('Dataset count:', datasetCount.toString());
        
        if (datasetCount.toNumber() === 0) {
            datasetsList.innerHTML = '<p class="info">No datasets created yet</p>';
            return;
        }
        
        datasetsList.innerHTML = '';
        
        for (let i = 0; i < datasetCount.toNumber(); i++) {
            const dataset = await contract.getDataset(i);
            const datasetCard = createDatasetCard(i, dataset);
            datasetsList.appendChild(datasetCard);
        }
        
        // Update dataset selector in proposal form
        updateDatasetSelector();
        
    } catch (error) {
        console.error('Failed to load datasets:', error);
        datasetsList.innerHTML = '<p class="error">Failed to load datasets</p>';
    }
}

// Create dataset card element
function createDatasetCard(id, dataset) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const [datasetId, name, owners, createdAt] = dataset;
    
    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">${name}</div>
                <small>Dataset ID: ${id}</small>
            </div>
            <button class="btn btn-secondary" onclick="viewDataset(${id})">View Details</button>
        </div>
        <div class="card-body">
            <div class="info-row">
                <span class="info-label">Owners:</span>
                <span class="info-value">${owners.length}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Created:</span>
                <span class="info-value">${new Date(createdAt.toNumber() * 1000).toLocaleString()}</span>
            </div>
        </div>
    `;
    
    return card;
}

// View dataset details
async function viewDataset(datasetId) {
    const modal = document.getElementById('dataset-modal');
    const detailsDiv = document.getElementById('modal-dataset-details');
    
    try {
        const dataset = await contract.getDataset(datasetId);
        const [id, name, owners, createdAt] = dataset;
        
        document.getElementById('modal-dataset-name').textContent = name;
        
        detailsDiv.innerHTML = `
            <div class="info-row">
                <span class="info-label">Dataset ID:</span>
                <span class="info-value">${datasetId}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Created:</span>
                <span class="info-value">${new Date(createdAt.toNumber() * 1000).toLocaleString()}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Number of Owners:</span>
                <span class="info-value">${owners.length}</span>
            </div>
            <div style="margin-top: 20px;">
                <strong>Owners:</strong>
                <ul style="margin-top: 10px;">
                    ${owners.map(owner => `<li style="font-family: 'Courier New', monospace; padding: 5px;">${owner}</li>`).join('')}
                </ul>
            </div>
        `;
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load dataset details:', error);
        showError('Failed to load dataset details');
    }
}

// Load proposals from contract
async function loadProposals() {
    if (!contract) return;
    
    const proposalsList = document.getElementById('proposals-list');
    proposalsList.innerHTML = '<p class="loading">Loading proposals...</p>';
    
    try {
        const proposalCount = await contract.proposalCount();
        console.log('Proposal count:', proposalCount.toString());
        
        if (proposalCount.toNumber() === 0) {
            proposalsList.innerHTML = '<p class="info">No proposals created yet</p>';
            return;
        }
        
        proposalsList.innerHTML = '';
        
        for (let i = 0; i < proposalCount.toNumber(); i++) {
            const proposal = await contract.getProposal(i);
            const proposalCard = createProposalCard(i, proposal);
            proposalsList.appendChild(proposalCard);
        }
        
    } catch (error) {
        console.error('Failed to load proposals:', error);
        proposalsList.innerHTML = '<p class="error">Failed to load proposals</p>';
    }
}

// Create proposal card element
function createProposalCard(id, proposal) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.proposalId = id;
    card.dataset.state = proposal[6]; // state
    
    const proposalTypes = ['Onboard Owner', 'Revoke Owner', 'Ingest Request', 'Access Request'];
    const stateLabels = ['pending', 'executed', 'rejected'];
    const stateBadges = ['badge-pending', 'badge-executed', 'badge-rejected'];
    
    const [proposalId, proposalType, datasetId, targetAddress, metadata, proposer, state, adminVotes, ownerVotes, createdAt] = proposal;
    
    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">Proposal #${id}: ${proposalTypes[proposalType]}</div>
                <small>Dataset ID: ${datasetId.toString()}</small>
            </div>
            <span class="badge ${stateBadges[state]}">${stateLabels[state]}</span>
        </div>
        <div class="card-body">
            <div class="info-row">
                <span class="info-label">Proposer:</span>
                <span class="info-value">${proposer.substring(0, 10)}...${proposer.substring(38)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Admin Votes:</span>
                <span class="info-value">${adminVotes.toString()}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Owner Votes:</span>
                <span class="info-value">${ownerVotes.toString()}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Created:</span>
                <span class="info-value">${new Date(createdAt.toNumber() * 1000).toLocaleString()}</span>
            </div>
            <div style="margin-top: 15px;">
                <button class="btn btn-secondary" onclick="viewProposal(${id})">View Details</button>
                ${state === 0 ? `<button class="btn btn-success" onclick="voteOnProposal(${id})">Vote</button>` : ''}
            </div>
        </div>
    `;
    
    return card;
}

// View proposal details
async function viewProposal(proposalId) {
    const modal = document.getElementById('proposal-modal');
    const detailsDiv = document.getElementById('modal-proposal-details');
    const votingSection = document.getElementById('modal-voting-section');
    
    try {
        const proposal = await contract.getProposal(proposalId);
        const hasVoted = await contract.hasVotedOnProposal(proposalId, currentAccount);
        
        const proposalTypes = ['Onboard Owner', 'Revoke Owner', 'Ingest Request', 'Access Request'];
        const stateLabels = ['Pending', 'Executed', 'Rejected'];
        
        const [id, proposalType, datasetId, targetAddress, metadata, proposer, state, adminVotes, ownerVotes, createdAt] = proposal;
        
        let metadataHtml = '';
        try {
            const metadataObj = JSON.parse(metadata);
            metadataHtml = '<pre style="background: #f8f9fa; padding: 15px; border-radius: 6px; overflow-x: auto;">' + 
                           JSON.stringify(metadataObj, null, 2) + '</pre>';
        } catch (e) {
            metadataHtml = `<p>${metadata}</p>`;
        }
        
        detailsDiv.innerHTML = `
            <div class="info-row">
                <span class="info-label">Proposal ID:</span>
                <span class="info-value">${proposalId}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Type:</span>
                <span class="info-value">${proposalTypes[proposalType]}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Dataset ID:</span>
                <span class="info-value">${datasetId.toString()}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">${stateLabels[state]}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Proposer:</span>
                <span class="info-value">${proposer}</span>
            </div>
            ${targetAddress !== ethers.constants.AddressZero ? `
            <div class="info-row">
                <span class="info-label">Target Address:</span>
                <span class="info-value">${targetAddress}</span>
            </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">Admin Votes:</span>
                <span class="info-value">${adminVotes.toString()}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Owner Votes:</span>
                <span class="info-value">${ownerVotes.toString()}</span>
            </div>
            <div style="margin-top: 20px;">
                <strong>Metadata:</strong>
                ${metadataHtml}
            </div>
        `;
        
        if (state === 0) {
            votingSection.innerHTML = `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e9ecef;">
                    <h3>Vote on this Proposal</h3>
                    ${hasVoted ? 
                        '<p class="info">You have already voted on this proposal</p>' :
                        '<button class="btn btn-success" onclick="voteOnProposal(' + proposalId + '); document.getElementById(\'proposal-modal\').style.display=\'none\';">Cast Vote</button>'
                    }
                </div>
            `;
        } else {
            votingSection.innerHTML = '';
        }
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Failed to load proposal details:', error);
        showError('Failed to load proposal details');
    }
}

// Vote on proposal
async function voteOnProposal(proposalId) {
    try {
        showInfo('Submitting vote...');
        
        const tx = await contract.voteOnProposal(proposalId);
        showInfo('Transaction submitted. Waiting for confirmation...');
        
        await tx.wait();
        showSuccess('Vote submitted successfully!');
        
        // Reload proposals
        await loadProposals();
        
    } catch (error) {
        console.error('Failed to vote:', error);
        showError('Failed to vote: ' + error.message);
    }
}

// Filter proposals
function filterProposals(filter) {
    const proposals = document.querySelectorAll('#proposals-list .card');
    
    proposals.forEach(card => {
        const state = card.dataset.state;
        
        if (filter === 'all') {
            card.style.display = 'block';
        } else if (filter === 'pending' && state === '0') {
            card.style.display = 'block';
        } else if (filter === 'executed' && state === '1') {
            card.style.display = 'block';
        } else if (filter === 'rejected' && state === '2') {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Handle create dataset form submission
async function handleCreateDataset(e) {
    e.preventDefault();
    
    try {
        const name = document.getElementById('dataset-name').value;
        const ownersText = document.getElementById('initial-owners').value;
        const owners = ownersText.split(',').map(addr => addr.trim());
        
        // Validate addresses
        for (const owner of owners) {
            if (!ethers.utils.isAddress(owner)) {
                showError(`Invalid address: ${owner}`);
                return;
            }
        }
        
        // Get schema
        const schema = getSchemaFromBuilder();
        
        if (schema.columns.length === 0) {
            showError('Please add at least one column to the schema');
            return;
        }
        
        showInfo('Creating dataset...');
        
        // Create dataset on blockchain
        const tx = await contract.createDataset(name, owners);
        showInfo('Transaction submitted. Waiting for confirmation...');
        
        const receipt = await tx.wait();
        const datasetId = receipt.events[receipt.events.length - 1].args.datasetId.toNumber();
        
        showSuccess(`Dataset created successfully! ID: ${datasetId}`);
        
        // Here you would normally upload the schema to MinIO
        // For now, we'll just log it
        console.log('Schema to be uploaded:', JSON.stringify(schema, null, 2));
        
        // Reset form
        document.getElementById('create-dataset-form').reset();
        document.getElementById('schema-builder').innerHTML = createSchemaColumn();
        
        // Reload datasets
        await loadDatasets();
        
    } catch (error) {
        console.error('Failed to create dataset:', error);
        showError('Failed to create dataset: ' + error.message);
    }
}

// Add schema column to builder
function addSchemaColumn() {
    const builder = document.getElementById('schema-builder');
    const column = createSchemaColumn();
    builder.insertAdjacentHTML('beforeend', column);
    
    // Add remove button listener
    const removeButtons = builder.querySelectorAll('.btn-remove-col');
    removeButtons[removeButtons.length - 1].addEventListener('click', function() {
        this.closest('.schema-column').remove();
    });
}

// Create schema column HTML
function createSchemaColumn() {
    return `
        <div class="schema-column">
            <input type="text" placeholder="Column Name" class="col-name">
            <select class="col-type">
                <option value="STRING">STRING</option>
                <option value="INT">INT</option>
                <option value="BIGINT">BIGINT</option>
                <option value="DOUBLE">DOUBLE</option>
                <option value="BOOLEAN">BOOLEAN</option>
                <option value="DATE">DATE</option>
                <option value="TIMESTAMP">TIMESTAMP</option>
            </select>
            <button type="button" class="btn-remove-col">×</button>
        </div>
    `;
}

// Get schema from builder
function getSchemaFromBuilder() {
    const columns = [];
    const schemaColumns = document.querySelectorAll('#schema-builder .schema-column');
    
    schemaColumns.forEach(col => {
        const name = col.querySelector('.col-name').value.trim();
        const type = col.querySelector('.col-type').value;
        
        if (name) {
            columns.push({ name, type });
        }
    });
    
    return { columns };
}

// Handle proposal type change
function handleProposalTypeChange() {
    const type = document.getElementById('proposal-type').value;
    
    // Hide all conditional forms
    document.querySelectorAll('.conditional-form').forEach(form => {
        form.style.display = 'none';
    });
    
    // Show relevant form
    if (type === '0' || type === '1') {
        document.getElementById('owner-proposal-form').style.display = 'block';
    } else if (type === '2') {
        document.getElementById('ingestion-proposal-form').style.display = 'block';
    } else if (type === '3') {
        document.getElementById('access-proposal-form').style.display = 'block';
    }
}

// Handle dataset change in proposal form
async function handleDatasetChange() {
    const datasetId = document.getElementById('proposal-dataset').value;
    const proposalType = document.getElementById('proposal-type').value;
    
    if (proposalType === '3' && datasetId) {
        // Load columns for access request
        await loadDatasetColumns(datasetId);
    }
}

// Load dataset columns for selection
async function loadDatasetColumns(datasetId) {
    const columnSelector = document.getElementById('column-selector');
    
    // This would normally fetch from MinIO
    // For demo, we'll use a sample schema
    const sampleColumns = [
        { name: 'customer_id', type: 'STRING' },
        { name: 'age', type: 'INT' },
        { name: 'income', type: 'INT' },
        { name: 'region', type: 'STRING' },
        { name: 'purchase_amount', type: 'DOUBLE' }
    ];
    
    columnSelector.innerHTML = sampleColumns.map(col => `
        <div class="column-checkbox">
            <input type="checkbox" id="col-${col.name}" value="${col.name}">
            <label for="col-${col.name}">${col.name} (${col.type})</label>
        </div>
    `).join('');
}

// Add filter row
function addFilterRow() {
    const filterBuilder = document.getElementById('filter-builder');
    
    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';
    filterRow.innerHTML = `
        <select class="filter-column">
            <option value="">Select Column</option>
            <option value="age">age</option>
            <option value="income">income</option>
            <option value="region">region</option>
            <option value="customer_id">customer_id</option>
        </select>
        <select class="filter-operator">
            <option value="=">=</option>
            <option value="!=">!=</option>
            <option value=">">></option>
            <option value=">=">>=</option>
            <option value="<"><</option>
            <option value="<="><=</option>
            <option value="IN">IN</option>
        </select>
        <input type="text" class="filter-value" placeholder="Value">
        <button type="button" class="btn-remove-col" onclick="this.closest('.filter-row').remove()">×</button>
    `;
    
    filterBuilder.appendChild(filterRow);
}

// Handle submit proposal
async function handleSubmitProposal() {
    try {
        const proposalType = document.getElementById('proposal-type').value;
        const datasetId = document.getElementById('proposal-dataset').value;
        
        if (!proposalType || !datasetId) {
            showError('Please select proposal type and dataset');
            return;
        }
        
        let targetAddress = ethers.constants.AddressZero;
        let metadata = {};
        
        if (proposalType === '0' || proposalType === '1') {
            // Owner operations
            targetAddress = document.getElementById('target-address').value;
            if (!ethers.utils.isAddress(targetAddress)) {
                showError('Invalid target address');
                return;
            }
            metadata = {
                action: proposalType === '0' ? 'onboard' : 'revoke',
                targetAddress
            };
        } else if (proposalType === '2') {
            // Ingestion request
            targetAddress = currentAccount;
            metadata = {
                filename: document.getElementById('filename').value,
                file_format: document.getElementById('file-format').value,
                purpose: document.getElementById('ingestion-purpose').value
            };
        } else if (proposalType === '3') {
            // Access request
            targetAddress = document.getElementById('requester-address').value || currentAccount;
            
            // Get selected columns
            const selectedColumns = Array.from(document.querySelectorAll('#column-selector input:checked'))
                .map(input => input.value);
            
            if (selectedColumns.length === 0) {
                showError('Please select at least one column');
                return;
            }
            
            // Build row filter
            const filterRows = document.querySelectorAll('.filter-row');
            const filters = [];
            filterRows.forEach(row => {
                const column = row.querySelector('.filter-column').value;
                const operator = row.querySelector('.filter-operator').value;
                const value = row.querySelector('.filter-value').value;
                
                if (column && value) {
                    filters.push(`${column} ${operator} '${value}'`);
                }
            });
            
            metadata = {
                columns: selectedColumns,
                row_filter: filters.join(' AND '),
                limit: parseInt(document.getElementById('result-limit').value),
                purpose: document.getElementById('access-purpose').value,
                justification: document.getElementById('justification').value
            };
        }
        
        showInfo('Creating proposal...');
        
        const tx = await contract.createProposal(
            proposalType,
            datasetId,
            targetAddress,
            JSON.stringify(metadata)
        );
        
        showInfo('Transaction submitted. Waiting for confirmation...');
        await tx.wait();
        
        showSuccess('Proposal created successfully!');
        
        // Reload proposals
        await loadProposals();
        
        // Switch to proposals tab
        switchTab('proposals');
        
    } catch (error) {
        console.error('Failed to create proposal:', error);
        showError('Failed to create proposal: ' + error.message);
    }
}

// Update dataset selector
async function updateDatasetSelector() {
    const selector = document.getElementById('proposal-dataset');
    
    try {
        const datasetCount = await contract.datasetCount();
        
        selector.innerHTML = '<option value="">-- Select Dataset --</option>';
        
        for (let i = 0; i < datasetCount.toNumber(); i++) {
            const dataset = await contract.getDataset(i);
            const [id, name] = dataset;
            
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${name} (ID: ${i})`;
            selector.appendChild(option);
        }
    } catch (error) {
        console.error('Failed to update dataset selector:', error);
    }
}

// Setup contract event listeners
function setupContractEventListeners() {
    if (!contract) return;
    
    // Listen for all events
    contract.on('DatasetCreated', (datasetId, name, creator, timestamp) => {
        logEvent('DatasetCreated', { datasetId: datasetId.toString(), name, creator });
        loadDatasets();
    });
    
    contract.on('ProposalCreated', (proposalId, proposalType, datasetId, proposer, metadata, timestamp) => {
        logEvent('ProposalCreated', { proposalId: proposalId.toString(), proposalType, datasetId: datasetId.toString() });
        loadProposals();
    });
    
    contract.on('ProposalVoted', (proposalId, voter, isAdmin, timestamp) => {
        logEvent('ProposalVoted', { proposalId: proposalId.toString(), voter, isAdmin });
        loadProposals();
    });
    
    contract.on('ProposalExecuted', (proposalId, proposalType, datasetId, timestamp) => {
        logEvent('ProposalExecuted', { proposalId: proposalId.toString(), proposalType, datasetId: datasetId.toString() });
        loadProposals();
    });
    
    contract.on('IngestionApproved', (proposalId, datasetId, metadata, timestamp) => {
        logEvent('IngestionApproved', { proposalId: proposalId.toString(), datasetId: datasetId.toString() });
    });
    
    contract.on('ColumnRowAccessGranted', (proposalId, datasetId, grantee, metadata, timestamp) => {
        logEvent('ColumnRowAccessGranted', { proposalId: proposalId.toString(), datasetId: datasetId.toString(), grantee });
    });
}

// Log event to UI
function logEvent(eventName, data) {
    const logsDiv = document.getElementById('event-logs');
    
    if (logsDiv.querySelector('.info')) {
        logsDiv.innerHTML = '';
    }
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <div class="log-timestamp">${new Date().toLocaleString()}</div>
        <strong>${eventName}</strong>
        <div style="margin-top: 5px;">${JSON.stringify(data, null, 2)}</div>
    `;
    
    logsDiv.insertBefore(logEntry, logsDiv.firstChild);
}

// Utility functions for showing messages
function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showInfo(message) {
    showMessage(message, 'info');
}

function showMessage(message, type) {
    // Remove existing messages
    document.querySelectorAll('.message-banner').forEach(el => el.remove());
    
    const banner = document.createElement('div');
    banner.className = `message-banner ${type}`;
    banner.textContent = message;
    banner.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 400px;
    `;
    
    if (type === 'error') {
        banner.style.background = '#f8d7da';
        banner.style.color = '#721c24';
        banner.style.border = '1px solid #f5c6cb';
    } else if (type === 'success') {
        banner.style.background = '#d4edda';
        banner.style.color = '#155724';
        banner.style.border = '1px solid #c3e6cb';
    } else {
        banner.style.background = '#d1ecf1';
        banner.style.color = '#0c5460';
        banner.style.border = '1px solid #bee5eb';
    }
    
    document.body.appendChild(banner);
    
    setTimeout(() => {
        banner.remove();
    }, 5000);
}

// Initialize on page load
window.addEventListener('load', init);