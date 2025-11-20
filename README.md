# Blockchain-Enabled Data Lake Governance System

A decentralized data lake governance system built on Ethereum blockchain with proposal-based access control for multi-institutional data sharing.

## 🎯 Overview

This system implements a blockchain-governed data lake where:
- **Datasets** are created and managed through smart contracts
- **Ingestion** requires proposal-based approval from admins and owners
- **Query access** is granted at column and row granularity through governance
- **Off-chain processing** handles actual data storage (MinIO) and queries (Trino)
- **Audit trails** are immutable and transparent

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Web3)                          │
│              MetaMask + Ethers.js + HTML/CSS/JS             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Hardhat Local Blockchain                        │
│                 DataLakeAccess.sol                          │
│     (Proposals, Voting, Access Control, Events)             │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             │ Events                        │ Function Calls
             ▼                               ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│  Off-Chain Services     │      │  MinIO (S3-Compatible)   │
│  (Node.js)              │◄────►│  - Datasets Storage      │
│  - Event Listeners      │      │  - Schema Storage        │
│  - SQL Generator        │      │  - Query Results         │
│  - Validation           │      │  - Audit Logs            │
└────────┬────────────────┘      └──────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│               Trino (Distributed SQL Engine)                 │
│                  with Hive Connector                        │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- **Node.js** v16+ and npm
- **Docker** and Docker Compose
- **MetaMask** browser extension
- **Git**

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd blockchain-datalake
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your MetaMask private key
```

### 3. Start Infrastructure

```bash
# Start MinIO and Trino
cd docker
docker-compose up -d
cd ..

# Wait for services to be ready (30-60 seconds)
```

### 4. Start Blockchain

```bash
# Terminal 1: Start Hardhat node
npx hardhat node
```

### 5. Deploy Contract

```bash
# Terminal 2: Deploy smart contract
npx hardhat run scripts/deploy.js --network localhost
```

### 6. Start Off-Chain Services

```bash
# Terminal 3: Start event listener and processor
npm run offchain
```

### 7. Start Frontend

```bash
# Terminal 4: Start web interface
npm run frontend
```

### 8. Configure MetaMask

1. Open MetaMask
2. Add Network:
   - **Network Name**: Hardhat Local
   - **RPC URL**: http://127.0.0.1:8545
   - **Chain ID**: 31337
   - **Currency Symbol**: ETH

3. Import Account:
   - Use one of the private keys from Hardhat node output
   - Or use your configured private key from .env

### 9. Access Application

Open browser and navigate to:
```
http://localhost:8000
```

## 📖 Usage Guide

### Creating a Dataset (Admin Only)

1. Connect MetaMask wallet
2. Navigate to **"Create Dataset"** tab
3. Fill in:
   - Dataset name
   - Initial owner addresses (comma-separated)
   - Schema definition (add columns with types)
4. Click **"Create Dataset"**
5. Approve transaction in MetaMask

### Creating an Ingestion Proposal

1. Navigate to **"Create Proposal"** tab
2. Select **"Ingestion Request"**
3. Choose dataset
4. Fill in metadata:
   - Filename
   - File format
   - Purpose
5. Submit proposal
6. Wait for admin and owner votes

### Creating an Access Request

1. Navigate to **"Create Proposal"** tab
2. Select **"Column/Row Access Request"**
3. Choose dataset
4. Select columns to access
5. Build row filters (optional)
6. Set result limit
7. Provide purpose and justification
8. Submit proposal

### Voting on Proposals

1. Navigate to **"Proposals"** tab
2. Click on a pending proposal
3. Review details
4. Click **"Vote"** button
5. Confirm transaction

**Voting Rules:**
- **Admin approval**: All admins must vote (unanimous)
- **Owner approval**: Majority of dataset owners must vote

### Viewing Results

Once a query access proposal is approved:
1. Off-chain service automatically executes the query
2. Results are saved to MinIO
3. Check off-chain service logs for result location
4. Access results from MinIO at: `datalake-results/dataset-<id>/proposal-<id>-<timestamp>.csv`

## 🔧 Development

### Contract Testing

```bash
npm test
```

### Compile Contracts

```bash
npm run compile
```

### View Logs

- **Blockchain**: Terminal 1 (Hardhat node)
- **Off-chain**: Terminal 3 (Off-chain services)
- **Frontend**: Browser console (F12)

## 📁 Project Structure

```
blockchain-datalake/
├── contracts/              # Solidity smart contracts
│   └── DataLakeAccess.sol
├── scripts/               # Deployment scripts
│   └── deploy.js
├── test/                  # Contract tests
├── frontend/              # Web interface
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── app.js
│   └── abi/              # Contract ABI (auto-generated)
├── offchain/             # Off-chain services
│   ├── index.js
│   ├── services/
│   │   ├── chain.js     # Event listeners
│   │   ├── executor.js  # Query/ingestion processor
│   │   ├── minio.js     # MinIO operations
│   │   └── trino.js     # Trino query execution
│   └── abi/             # Contract ABI (auto-generated)
├── docker/               # Docker configuration
│   ├── docker-compose.yml
│   └── trino/
│       ├── config.properties
│       └── catalog/
│           └── hive.properties
├── hardhat.config.js     # Hardhat configuration
├── package.json
└── .env                  # Environment variables
```

## 🔐 Security Considerations

- **Private Keys**: Never commit .env file with real private keys
- **Access Control**: All operations are governed by smart contract roles
- **SQL Injection**: SQL is constructed server-side, not from user input
- **Audit Trail**: All governance actions are logged on-chain
- **Filter Validation**: Row filters are validated to prevent malicious queries

## 🔍 Troubleshooting

### MetaMask Connection Issues

- Ensure correct network (Chain ID 31337)
- Refresh page and reconnect
- Check Hardhat node is running

### Contract Not Found

- Ensure contract is deployed: `npm run deploy`
- Check ABI files exist in `frontend/abi/` and `offchain/abi/`

### MinIO/Trino Not Accessible

```bash
# Check containers are running
docker ps

# View logs
docker logs blockchain-datalake-minio
docker logs blockchain-datalake-trino

# Restart services
cd docker
docker-compose restart
```

### Off-Chain Service Errors

- Ensure contract is deployed first
- Check WebSocket connection to Hardhat node
- Verify MinIO and Trino are running
- Check environment variables in .env

## 🌟 Features

- ✅ Decentralized governance through proposals and voting
- ✅ Role-based access control (Admins, Owners, Requesters)
- ✅ Column and row-level access control
- ✅ Controlled SQL generation (no user-supplied SQL)
- ✅ Immutable audit trails
- ✅ Event-driven architecture
- ✅ MinIO S3-compatible storage
- ✅ Trino distributed query engine
- ✅ MetaMask wallet integration
- ✅ Real-time event monitoring

## 🛣️ Roadmap

- [ ] Multi-file ingestion support
- [ ] Result encryption for sensitive data
- [ ] Advanced query optimization
- [ ] RBAC extensions (custom roles)
- [ ] Query result notifications
- [ ] Data lineage tracking
- [ ] Integration with existing identity providers
- [ ] Production deployment configurations
- [ ] Automated testing suite
- [ ] Performance benchmarks

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Review logs for error messages

## 🙏 Acknowledgments

- Ethereum and Hardhat teams
- MinIO Project
- Trino (formerly PrestoSQL)
- OpenZeppelin for security patterns
