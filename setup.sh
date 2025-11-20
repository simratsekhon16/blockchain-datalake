#!/bin/bash

echo "=========================================="
echo "Blockchain Data Lake Setup Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js v16+ from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm found: $(npm --version)${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Warning: Docker is not installed${NC}"
    echo "Docker is required for MinIO and Trino"
    echo "Please install Docker from https://www.docker.com/"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Warning: Docker Compose is not installed${NC}"
fi

echo ""
echo "Step 1: Installing Node.js dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: npm install failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Step 2: Creating .env file..."
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠ Please edit .env and add your MetaMask private key${NC}"
else
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
fi

echo ""
echo "Step 3: Compiling smart contracts..."
npx hardhat compile

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Contract compilation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Contracts compiled${NC}"
echo ""

# Create necessary directories
mkdir -p frontend/abi
mkdir -p offchain/abi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Edit .env file and add your MetaMask private key"
echo ""
echo "2. Start Docker services (MinIO & Trino):"
echo "   cd docker"
echo "   docker-compose up -d"
echo ""
echo "3. Start Hardhat node (Terminal 1):"
echo "   npx hardhat node"
echo ""
echo "4. Deploy contract (Terminal 2):"
echo "   npx hardhat run scripts/deploy.js --network localhost"
echo ""
echo "5. Start off-chain services (Terminal 3):"
echo "   npm run offchain"
echo ""
echo "6. Start frontend (Terminal 4):"
echo "   npm run frontend"
echo ""
echo "7. Configure MetaMask:"
echo "   - Network: Hardhat Local"
echo "   - RPC URL: http://127.0.0.1:8545"
echo "   - Chain ID: 31337"
echo ""
echo "8. Open browser:"
echo "   http://localhost:8000"
echo ""
echo "=========================================="
