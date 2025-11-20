const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying DataLakeAccess contract...");

  // Get the deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy the contract
  const DataLakeAccess = await hre.ethers.getContractFactory("DataLakeAccess");
  const contract = await DataLakeAccess.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("DataLakeAccess deployed to:", contractAddress);

  // Get the contract artifact
  const artifact = await hre.artifacts.readArtifact("DataLakeAccess");

  // Create deployment info
  const deploymentInfo = {
    address: contractAddress,
    deployer: deployer.address,
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    abi: artifact.abi
  };

  // Save ABI and address to frontend
  const frontendAbiDir = path.join(__dirname, "..", "frontend", "abi");
  if (!fs.existsSync(frontendAbiDir)) {
    fs.mkdirSync(frontendAbiDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(frontendAbiDir, "DataLakeAccess.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Save ABI and address to offchain
  const offchainAbiDir = path.join(__dirname, "..", "offchain", "abi");
  if (!fs.existsSync(offchainAbiDir)) {
    fs.mkdirSync(offchainAbiDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(offchainAbiDir, "DataLakeAccess.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Contract ABI and address saved to frontend/abi and offchain/abi");

  // Verify initial state
  const adminCount = await contract.adminCount();
  const isAdmin = await contract.isAdmin(deployer.address);
  console.log("\nInitial contract state:");
  console.log("Admin count:", adminCount.toString());
  console.log("Deployer is admin:", isAdmin);

  console.log("\nDeployment complete!");
  console.log("Contract address:", contractAddress);
  console.log("Network:", hre.network.name);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
