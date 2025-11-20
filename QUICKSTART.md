# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js v16+
- Docker & Docker Compose
- MetaMask browser extension

### Step-by-Step Setup

#### 1. Install Dependencies
```bash
chmod +x setup.sh
./setup.sh
```

#### 2. Configure Environment
```bash
# Edit .env file
nano .env

# Add your MetaMask private key:
PRIVATE_KEY=your_private_key_here
```

#### 3. Start Services

**Terminal 1 - Start Docker Services:**
```bash
cd docker
docker-compose up -d
cd ..
```

Wait 30-60 seconds for services to initialize.

**Terminal 2 - Start Blockchain:**
```bash
npx hardhat node
```

Keep this running. You'll see 20 test accounts with private keys.

**Terminal 3 - Deploy Contract:**
```bash
npx hardhat run scripts/deploy.js --network localhost
```

**Terminal 4 - Start Off-Chain Services:**
```bash
npm run offchain
```

**Terminal 5 - Start Frontend:**
```bash
npm run frontend
```

#### 4. Configure MetaMask

1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Fill in:
   - **Network Name**: Hardhat Local
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `31337`
   - **Currency Symbol**: `ETH`

4. Import test account:
   - Copy any private key from Terminal 2 (Hardhat node)
   - MetaMask → Account menu → Import Account
   - Paste private key

#### 5. Open Application

Navigate to: **http://localhost:8000**

Click "Connect MetaMask" and approve the connection.

## 🎯 Try It Out

### Create Your First Dataset

1. Go to **"Create Dataset"** tab
2. Enter:
   - Name: `Customer Data`
   - Initial Owners: Your connected address
3. Add columns:
   - `customer_id` (STRING)
   - `age` (INT)
   - `region` (STRING)
4. Click **"Create Dataset"**
5. Approve transaction in MetaMask

### Create an Access Request

1. Go to **"Create Proposal"** tab
2. Select:
   - Type: `Column/Row Access Request`
   - Dataset: Your dataset
   - Requester: Your address
3. Select columns to access
4. Add row filter (optional):
   - Column: `age`
   - Operator: `>`
   - Value: `18`
5. Fill purpose and justification
6. Click **"Submit Proposal"**

### Vote on Proposal

1. Go to **"Proposals"** tab
2. Click your pending proposal
3. Click **"Vote"**
4. Approve transaction

Since you're the only admin and owner, the proposal will execute immediately!

## 📊 Check Results

Watch Terminal 4 (Off-Chain Services) for:
- Event processing
- Query execution
- Result storage location

Query results are saved to MinIO at:
```
datalake-results/dataset-<id>/proposal-<id>-<timestamp>.csv
```

## 🔍 Access MinIO Console

Open: **http://localhost:9001**

Login:
- Username: `minioadmin`
- Password: `minioadmin`

Browse buckets:
- `datasets` - Raw data files
- `schemas` - Dataset schemas
- `datalake-results` - Query results
- `audit` - Audit logs

## 🛠️ Troubleshooting

### Connection Issues
```bash
# Check all services are running
docker ps
npx hardhat node  # Should show "Started HTTP and WebSocket JSON-RPC server"
```

### Reset Everything
```bash
# Stop all services
docker-compose down
# Remove volumes
docker-compose down -v
# Restart Hardhat node (Ctrl+C, then restart)
npx hardhat node
# Redeploy
npx hardhat run scripts/deploy.js --network localhost
```

### Contract Not Found
```bash
# Make sure contract is deployed
ls frontend/abi/DataLakeAccess.json
ls offchain/abi/DataLakeAccess.json

# If missing, redeploy:
npx hardhat run scripts/deploy.js --network localhost
```

## 📚 Next Steps

- Read the full [README.md](README.md)
- Explore the [contract code](contracts/DataLakeAccess.sol)
- Check [test suite](test/DataLakeAccess.test.js)
- Run tests: `npm test`

## 🎓 Learning Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [MinIO Documentation](https://min.io/docs/)
- [Trino Documentation](https://trino.io/docs/)

## 💡 Tips

- Use multiple browser profiles to test with different accounts
- Check event logs in the "Event Logs" tab
- Monitor off-chain terminal for detailed processing logs
- Use browser dev tools (F12) to debug frontend issues

---

**Happy Building! 🎉**
