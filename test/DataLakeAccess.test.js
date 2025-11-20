const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DataLakeAccess", function () {
  let dataLakeAccess;
  let owner;
  let admin2;
  let owner1;
  let owner2;
  let user;

  beforeEach(async function () {
    [owner, admin2, owner1, owner2, user] = await ethers.getSigners();

    const DataLakeAccess = await ethers.getContractFactory("DataLakeAccess");
    dataLakeAccess = await DataLakeAccess.deploy();
    await dataLakeAccess.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the deployer as admin", async function () {
      expect(await dataLakeAccess.isAdmin(owner.address)).to.equal(true);
      expect(await dataLakeAccess.adminCount()).to.equal(1);
    });

    it("Should have zero datasets initially", async function () {
      expect(await dataLakeAccess.datasetCount()).to.equal(0);
    });

    it("Should have zero proposals initially", async function () {
      expect(await dataLakeAccess.proposalCount()).to.equal(0);
    });
  });

  describe("Admin Management", function () {
    it("Should allow admin to add new admin", async function () {
      await dataLakeAccess.addAdmin(admin2.address);
      expect(await dataLakeAccess.isAdmin(admin2.address)).to.equal(true);
      expect(await dataLakeAccess.adminCount()).to.equal(2);
    });

    it("Should not allow non-admin to add admin", async function () {
      await expect(
        dataLakeAccess.connect(user).addAdmin(admin2.address)
      ).to.be.revertedWith("Not an admin");
    });

    it("Should not allow adding duplicate admin", async function () {
      await dataLakeAccess.addAdmin(admin2.address);
      await expect(
        dataLakeAccess.addAdmin(admin2.address)
      ).to.be.revertedWith("Already an admin");
    });

    it("Should allow removing admin", async function () {
      await dataLakeAccess.addAdmin(admin2.address);
      await dataLakeAccess.removeAdmin(admin2.address);
      expect(await dataLakeAccess.isAdmin(admin2.address)).to.equal(false);
      expect(await dataLakeAccess.adminCount()).to.equal(1);
    });

    it("Should not allow removing last admin", async function () {
      await expect(
        dataLakeAccess.removeAdmin(owner.address)
      ).to.be.revertedWith("Cannot remove last admin");
    });
  });

  describe("Dataset Management", function () {
    it("Should allow admin to create dataset", async function () {
      const tx = await dataLakeAccess.createDataset(
        "Test Dataset",
        [owner1.address, owner2.address]
      );
      
      await tx.wait();
      
      expect(await dataLakeAccess.datasetCount()).to.equal(1);
      
      const dataset = await dataLakeAccess.getDataset(0);
      expect(dataset[1]).to.equal("Test Dataset"); // name
      expect(dataset[2].length).to.equal(2); // owners count
    });

    it("Should not allow non-admin to create dataset", async function () {
      await expect(
        dataLakeAccess.connect(user).createDataset("Test", [owner1.address])
      ).to.be.revertedWith("Not an admin");
    });

    it("Should not allow creating dataset with empty name", async function () {
      await expect(
        dataLakeAccess.createDataset("", [owner1.address])
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should not allow creating dataset without owners", async function () {
      await expect(
        dataLakeAccess.createDataset("Test", [])
      ).to.be.revertedWith("Must have at least one owner");
    });

    it("Should verify dataset ownership", async function () {
      await dataLakeAccess.createDataset("Test", [owner1.address, owner2.address]);
      
      expect(await dataLakeAccess.isDatasetOwner(0, owner1.address)).to.equal(true);
      expect(await dataLakeAccess.isDatasetOwner(0, owner2.address)).to.equal(true);
      expect(await dataLakeAccess.isDatasetOwner(0, user.address)).to.equal(false);
    });
  });

  describe("Proposal Management", function () {
    beforeEach(async function () {
      // Create a dataset for proposals
      await dataLakeAccess.createDataset("Test Dataset", [owner1.address, owner2.address]);
    });

    it("Should allow creating ingestion proposal", async function () {
      const metadata = JSON.stringify({
        filename: "test.parquet",
        purpose: "Testing ingestion"
      });

      await dataLakeAccess.createProposal(
        2, // INGEST_REQUEST
        0, // dataset ID
        owner1.address,
        metadata
      );

      expect(await dataLakeAccess.proposalCount()).to.equal(1);
      
      const proposal = await dataLakeAccess.getProposal(0);
      expect(proposal[1]).to.equal(2); // proposal type
      expect(proposal[2]).to.equal(0); // dataset ID
    });

    it("Should allow creating access proposal", async function () {
      const metadata = JSON.stringify({
        columns: ["age", "region"],
        row_filter: "age > 18",
        limit: 1000
      });

      await dataLakeAccess.createProposal(
        3, // COLUMN_ROW_ACCESS_REQUEST
        0,
        user.address,
        metadata
      );

      expect(await dataLakeAccess.proposalCount()).to.equal(1);
    });

    it("Should not allow creating proposal for non-existent dataset", async function () {
      await expect(
        dataLakeAccess.createProposal(2, 999, owner1.address, "{}")
      ).to.be.revertedWith("Dataset does not exist");
    });

    it("Should allow admin to vote on proposal", async function () {
      await dataLakeAccess.createProposal(2, 0, owner1.address, "{}");
      
      await dataLakeAccess.voteOnProposal(0);
      
      const proposal = await dataLakeAccess.getProposal(0);
      expect(proposal[7]).to.equal(1); // admin vote count
    });

    it("Should allow owner to vote on proposal", async function () {
      await dataLakeAccess.createProposal(2, 0, owner1.address, "{}");
      
      await dataLakeAccess.connect(owner1).voteOnProposal(0);
      
      const proposal = await dataLakeAccess.getProposal(0);
      expect(proposal[8]).to.equal(1); // owner vote count
    });

    it("Should not allow voting twice", async function () {
      await dataLakeAccess.createProposal(2, 0, owner1.address, "{}");
      
      await dataLakeAccess.voteOnProposal(0);
      
      await expect(
        dataLakeAccess.voteOnProposal(0)
      ).to.be.revertedWith("Already voted");
    });

    it("Should not allow non-authorized user to vote", async function () {
      await dataLakeAccess.createProposal(2, 0, owner1.address, "{}");
      
      await expect(
        dataLakeAccess.connect(user).voteOnProposal(0)
      ).to.be.revertedWith("Not authorized to vote");
    });

    it("Should execute proposal when requirements met", async function () {
      await dataLakeAccess.createProposal(2, 0, owner1.address, "{}");
      
      // Admin vote
      await dataLakeAccess.voteOnProposal(0);
      
      // Owner votes (need majority)
      await dataLakeAccess.connect(owner1).voteOnProposal(0);
      
      const proposal = await dataLakeAccess.getProposal(0);
      expect(proposal[6]).to.equal(1); // state should be EXECUTED
    });

    it("Should allow admin to reject proposal", async function () {
      await dataLakeAccess.createProposal(2, 0, owner1.address, "{}");
      
      await dataLakeAccess.rejectProposal(0, "Invalid request");
      
      const proposal = await dataLakeAccess.getProposal(0);
      expect(proposal[6]).to.equal(2); // state should be REJECTED
    });
  });

  describe("Ingestion Registration", function () {
    beforeEach(async function () {
      await dataLakeAccess.createDataset("Test Dataset", [owner1.address]);
    });

    it("Should allow owner to register ingestion", async function () {
      const storagePath = "datasets/0/raw/123456789/test.parquet";
      
      await dataLakeAccess.connect(owner1).registerIngest(0, storagePath);
      
      expect(await dataLakeAccess.ingestionCount()).to.equal(1);
      
      const record = await dataLakeAccess.ingestionRecords(0);
      expect(record.datasetId).to.equal(0);
      expect(record.storagePath).to.equal(storagePath);
      expect(record.ingestor).to.equal(owner1.address);
    });

    it("Should not allow non-owner to register ingestion", async function () {
      await expect(
        dataLakeAccess.connect(user).registerIngest(0, "path")
      ).to.be.revertedWith("Not a dataset owner or admin");
    });

    it("Should allow admin to register ingestion", async function () {
      await dataLakeAccess.registerIngest(0, "path");
      expect(await dataLakeAccess.ingestionCount()).to.equal(1);
    });
  });

  describe("Events", function () {
    it("Should emit DatasetCreated event", async function () {
      await expect(dataLakeAccess.createDataset("Test", [owner1.address]))
        .to.emit(dataLakeAccess, "DatasetCreated")
        .withArgs(0, "Test", owner.address, await getTimestamp());
    });

    it("Should emit ProposalCreated event", async function () {
      await dataLakeAccess.createDataset("Test", [owner1.address]);
      
      await expect(dataLakeAccess.createProposal(2, 0, owner1.address, "{}"))
        .to.emit(dataLakeAccess, "ProposalCreated");
    });

    it("Should emit ProposalVoted event", async function () {
      await dataLakeAccess.createDataset("Test", [owner1.address]);
      await dataLakeAccess.createProposal(2, 0, owner1.address, "{}");
      
      await expect(dataLakeAccess.voteOnProposal(0))
        .to.emit(dataLakeAccess, "ProposalVoted")
        .withArgs(0, owner.address, true, await getTimestamp());
    });
  });

  // Helper function
  async function getTimestamp() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block.timestamp;
  }
});
