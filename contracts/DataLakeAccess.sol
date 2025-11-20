// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DataLakeAccess
 * @notice Blockchain-enabled data lake governance system
 * @dev Multi-institution data lake with proposal-based governance
 */
contract DataLakeAccess {
    
    // ========== ENUMS ==========
    
    enum ProposalType {
        ONBOARD_OWNER,
        REVOKE_OWNER,
        INGEST_REQUEST,
        COLUMN_ROW_ACCESS_REQUEST
    }
    
    enum ProposalState {
        PENDING,
        EXECUTED,
        REJECTED
    }
    
    // ========== STRUCTS ==========
    
    struct Dataset {
        uint256 datasetId;
        string name;
        address[] owners;
        mapping(address => bool) isOwner;
        bool exists;
        uint256 createdAt;
    }
    
    struct Proposal {
        uint256 proposalId;
        ProposalType proposalType;
        uint256 datasetId;
        address targetAddress;
        string metadata; // JSON metadata
        address proposer;
        ProposalState state;
        uint256 adminVoteCount;
        uint256 ownerVoteCount;
        mapping(address => bool) hasVoted;
        uint256 createdAt;
    }
    
    struct IngestionRecord {
        uint256 datasetId;
        string storagePath;
        address ingestor;
        uint256 timestamp;
    }
    
    // ========== STATE VARIABLES ==========
    
    address public immutable deployer;
    
    // Admin management
    address[] public admins;
    mapping(address => bool) public isAdmin;
    uint256 public adminCount;
    
    // Dataset management
    uint256 public datasetCount;
    mapping(uint256 => Dataset) private datasets;
    
    // Proposal management
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private proposals;
    
    // Ingestion records
    uint256 public ingestionCount;
    mapping(uint256 => IngestionRecord) public ingestionRecords;
    
    // Access grants tracking
    mapping(uint256 => mapping(address => bool)) public hasColumnRowAccess;
    
    // ========== EVENTS ==========
    
    event AdminAdded(address indexed admin, uint256 timestamp);
    event AdminRemoved(address indexed admin, uint256 timestamp);
    
    event DatasetCreated(
        uint256 indexed datasetId,
        string name,
        address indexed creator,
        uint256 timestamp
    );
    
    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType proposalType,
        uint256 indexed datasetId,
        address indexed proposer,
        string metadata,
        uint256 timestamp
    );
    
    event ProposalVoted(
        uint256 indexed proposalId,
        address indexed voter,
        bool isAdmin,
        uint256 timestamp
    );
    
    event ProposalExecuted(
        uint256 indexed proposalId,
        ProposalType proposalType,
        uint256 indexed datasetId,
        uint256 timestamp
    );
    
    event ProposalRejected(
        uint256 indexed proposalId,
        string reason,
        uint256 timestamp
    );
    
    event OwnerAdded(
        uint256 indexed datasetId,
        address indexed owner,
        uint256 timestamp
    );
    
    event OwnerRevoked(
        uint256 indexed datasetId,
        address indexed owner,
        uint256 timestamp
    );
    
    event IngestionApproved(
        uint256 indexed proposalId,
        uint256 indexed datasetId,
        string metadata,
        uint256 timestamp
    );
    
    event IngestionRegistered(
        uint256 indexed ingestionId,
        uint256 indexed datasetId,
        string storagePath,
        address indexed ingestor,
        uint256 timestamp
    );
    
    event ColumnRowAccessGranted(
        uint256 indexed proposalId,
        uint256 indexed datasetId,
        address indexed grantee,
        string metadata,
        uint256 timestamp
    );
    
    // ========== MODIFIERS ==========
    
    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not an admin");
        _;
    }
    
    modifier onlyDatasetOwner(uint256 datasetId) {
        require(datasets[datasetId].exists, "Dataset does not exist");
        require(
            datasets[datasetId].isOwner[msg.sender] || isAdmin[msg.sender],
            "Not a dataset owner or admin"
        );
        _;
    }
    
    modifier datasetExists(uint256 datasetId) {
        require(datasets[datasetId].exists, "Dataset does not exist");
        _;
    }
    
    modifier proposalExists(uint256 proposalId) {
        require(proposalId < proposalCount, "Proposal does not exist");
        _;
    }
    
    modifier proposalPending(uint256 proposalId) {
        require(
            proposals[proposalId].state == ProposalState.PENDING,
            "Proposal not pending"
        );
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor() {
        deployer = msg.sender;
        admins.push(msg.sender);
        isAdmin[msg.sender] = true;
        adminCount = 1;
        
        emit AdminAdded(msg.sender, block.timestamp);
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    function addAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        require(!isAdmin[newAdmin], "Already an admin");
        
        admins.push(newAdmin);
        isAdmin[newAdmin] = true;
        adminCount++;
        
        emit AdminAdded(newAdmin, block.timestamp);
    }
    
    function removeAdmin(address admin) external onlyAdmin {
        require(isAdmin[admin], "Not an admin");
        require(adminCount > 1, "Cannot remove last admin");
        require(admin != deployer, "Cannot remove deployer");
        
        isAdmin[admin] = false;
        adminCount--;
        
        emit AdminRemoved(admin, block.timestamp);
    }
    
    function createDataset(
        string calldata name,
        address[] calldata initialOwners
    ) external onlyAdmin returns (uint256) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(initialOwners.length > 0, "Must have at least one owner");
        
        uint256 datasetId = datasetCount++;
        Dataset storage dataset = datasets[datasetId];
        
        dataset.datasetId = datasetId;
        dataset.name = name;
        dataset.exists = true;
        dataset.createdAt = block.timestamp;
        
        for (uint256 i = 0; i < initialOwners.length; i++) {
            address owner = initialOwners[i];
            require(owner != address(0), "Invalid owner address");
            require(!dataset.isOwner[owner], "Duplicate owner");
            
            dataset.owners.push(owner);
            dataset.isOwner[owner] = true;
        }
        
        emit DatasetCreated(datasetId, name, msg.sender, block.timestamp);
        
        return datasetId;
    }
    
    // ========== PROPOSAL FUNCTIONS ==========
    
    function createProposal(
        ProposalType proposalType,
        uint256 datasetId,
        address targetAddress,
        string calldata metadata
    ) external datasetExists(datasetId) returns (uint256) {
        require(bytes(metadata).length > 0, "Metadata cannot be empty");
        
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.proposalId = proposalId;
        proposal.proposalType = proposalType;
        proposal.datasetId = datasetId;
        proposal.targetAddress = targetAddress;
        proposal.metadata = metadata;
        proposal.proposer = msg.sender;
        proposal.state = ProposalState.PENDING;
        proposal.createdAt = block.timestamp;
        
        emit ProposalCreated(
            proposalId,
            proposalType,
            datasetId,
            msg.sender,
            metadata,
            block.timestamp
        );
        
        return proposalId;
    }
    
    function voteOnProposal(uint256 proposalId)
        external
        proposalExists(proposalId)
        proposalPending(proposalId)
    {
        Proposal storage proposal = proposals[proposalId];
        Dataset storage dataset = datasets[proposal.datasetId];
        
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(
            isAdmin[msg.sender] || dataset.isOwner[msg.sender],
            "Not authorized to vote"
        );
        
        proposal.hasVoted[msg.sender] = true;
        
        bool voterIsAdmin = isAdmin[msg.sender];
        if (voterIsAdmin) {
            proposal.adminVoteCount++;
        } else {
            proposal.ownerVoteCount++;
        }
        
        emit ProposalVoted(proposalId, msg.sender, voterIsAdmin, block.timestamp);
        
        _checkAndExecuteProposal(proposalId);
    }
    
    function _checkAndExecuteProposal(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        Dataset storage dataset = datasets[proposal.datasetId];
        
        bool adminApproved = (proposal.adminVoteCount == adminCount);
        uint256 requiredOwnerVotes = (dataset.owners.length / 2) + 1;
        bool ownerApproved = (proposal.ownerVoteCount >= requiredOwnerVotes);
        
        if (adminApproved && ownerApproved) {
            _executeProposal(proposalId);
        }
    }
    
    function _executeProposal(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        proposal.state = ProposalState.EXECUTED;
        
        if (proposal.proposalType == ProposalType.ONBOARD_OWNER) {
            _addOwner(proposal.datasetId, proposal.targetAddress);
        } else if (proposal.proposalType == ProposalType.REVOKE_OWNER) {
            _revokeOwner(proposal.datasetId, proposal.targetAddress);
        } else if (proposal.proposalType == ProposalType.INGEST_REQUEST) {
            emit IngestionApproved(
                proposalId,
                proposal.datasetId,
                proposal.metadata,
                block.timestamp
            );
        } else if (proposal.proposalType == ProposalType.COLUMN_ROW_ACCESS_REQUEST) {
            hasColumnRowAccess[proposal.datasetId][proposal.targetAddress] = true;
            emit ColumnRowAccessGranted(
                proposalId,
                proposal.datasetId,
                proposal.targetAddress,
                proposal.metadata,
                block.timestamp
            );
        }
        
        emit ProposalExecuted(
            proposalId,
            proposal.proposalType,
            proposal.datasetId,
            block.timestamp
        );
    }
    
    function rejectProposal(uint256 proposalId, string calldata reason)
        external
        onlyAdmin
        proposalExists(proposalId)
        proposalPending(proposalId)
    {
        Proposal storage proposal = proposals[proposalId];
        proposal.state = ProposalState.REJECTED;
        
        emit ProposalRejected(proposalId, reason, block.timestamp);
    }
    
    // ========== OWNER MANAGEMENT ==========
    
    function _addOwner(uint256 datasetId, address owner) internal {
        Dataset storage dataset = datasets[datasetId];
        require(!dataset.isOwner[owner], "Already an owner");
        
        dataset.owners.push(owner);
        dataset.isOwner[owner] = true;
        
        emit OwnerAdded(datasetId, owner, block.timestamp);
    }
    
    function _revokeOwner(uint256 datasetId, address owner) internal {
        Dataset storage dataset = datasets[datasetId];
        require(dataset.isOwner[owner], "Not an owner");
        require(dataset.owners.length > 1, "Cannot remove last owner");
        
        dataset.isOwner[owner] = false;
        
        emit OwnerRevoked(datasetId, owner, block.timestamp);
    }
    
    // ========== INGESTION FUNCTIONS ==========
    
    function registerIngest(uint256 datasetId, string calldata storagePath)
        external
        datasetExists(datasetId)
        onlyDatasetOwner(datasetId)
    {
        uint256 ingestionId = ingestionCount++;
        
        ingestionRecords[ingestionId] = IngestionRecord({
            datasetId: datasetId,
            storagePath: storagePath,
            ingestor: msg.sender,
            timestamp: block.timestamp
        });
        
        emit IngestionRegistered(
            ingestionId,
            datasetId,
            storagePath,
            msg.sender,
            block.timestamp
        );
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    function getDataset(uint256 datasetId)
        external
        view
        datasetExists(datasetId)
        returns (
            uint256,
            string memory,
            address[] memory,
            uint256
        )
    {
        Dataset storage dataset = datasets[datasetId];
        return (
            dataset.datasetId,
            dataset.name,
            dataset.owners,
            dataset.createdAt
        );
    }
    
    function isDatasetOwner(uint256 datasetId, address owner)
        external
        view
        datasetExists(datasetId)
        returns (bool)
    {
        return datasets[datasetId].isOwner[owner];
    }
    
    function getProposal(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
            uint256,
            ProposalType,
            uint256,
            address,
            string memory,
            address,
            ProposalState,
            uint256,
            uint256,
            uint256
        )
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposalId,
            proposal.proposalType,
            proposal.datasetId,
            proposal.targetAddress,
            proposal.metadata,
            proposal.proposer,
            proposal.state,
            proposal.adminVoteCount,
            proposal.ownerVoteCount,
            proposal.createdAt
        );
    }
    
    function hasVotedOnProposal(uint256 proposalId, address voter)
        external
        view
        proposalExists(proposalId)
        returns (bool)
    {
        return proposals[proposalId].hasVoted[voter];
    }
    
    function getAdmins() external view returns (address[] memory) {
        address[] memory activeAdmins = new address[](adminCount);
        uint256 count = 0;
        
        for (uint256 i = 0; i < admins.length; i++) {
            if (isAdmin[admins[i]]) {
                activeAdmins[count] = admins[i];
                count++;
            }
        }
        
        return activeAdmins;
    }
    
    function getDatasetOwnerCount(uint256 datasetId)
        external
        view
        datasetExists(datasetId)
        returns (uint256)
    {
        return datasets[datasetId].owners.length;
    }
}
