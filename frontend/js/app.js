// public/js/app.js

// ================= GLOBAL STATE =================

let provider;
let signer;
let contract;
let currentAccount;
let contractData;

const schemaCache = {};
const BACKEND_BASE_URL = "http://localhost:3001";

// ================= CONTRACT BOOTSTRAP =================

async function loadContractData() {
  try {
    const resp = await fetch("abi/DataLakeAccess.json");
    contractData = await resp.json();
    return contractData;
  } catch (err) {
    console.error("Failed to load contract data:", err);
    showError("Failed to load contract ABI/address.");
    return null;
  }
}

async function init() {
  const data = await loadContractData();
  if (!data) return;

  setupEventListeners();

  if (!window.ethereum) {
    showError("MetaMask not detected.");
    return;
  }

  // Auto-reconnect if already authorized
  try {
    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      await connectWallet();
    }
  } catch (err) {
    console.warn("Auto-connect skipped:", err);
  }
}

async function connectWallet() {
  try {
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    currentAccount = accounts[0];

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    contract = new ethers.Contract(contractData.address, contractData.abi, signer);

    // UI
    document.getElementById("account-address").textContent =
      currentAccount.substring(0, 6) + "..." + currentAccount.substring(38);

    const btn = document.getElementById("connect-wallet");
    btn.textContent = "Connected";
    btn.disabled = true;

    await loadDatasets();
    await loadProposals();
    setupContractEventListeners();

    showSuccess("Wallet connected");
  } catch (err) {
    console.error("Wallet connect failed:", err);
    showError(err.message || "Failed to connect wallet");
  }
}

// ================= UI WIRING =================

function setupEventListeners() {
  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Wallet
  document.getElementById("connect-wallet").addEventListener("click", connectWallet);

  // Create dataset
  document
    .getElementById("create-dataset-form")
    .addEventListener("submit", handleCreateDataset);
  document.getElementById("add-column").addEventListener("click", addSchemaColumn);

  // Attach remove to initial schema column
  document
    .querySelectorAll("#schema-builder .btn-remove-col")
    .forEach((btn) => {
      btn.addEventListener("click", function () {
        this.closest(".schema-column").remove();
      });
    });

  // Proposals
  document
    .getElementById("proposal-type")
    .addEventListener("change", handleProposalTypeChange);
  document
    .getElementById("proposal-dataset")
    .addEventListener("change", handleDatasetChange);
  document
    .getElementById("submit-proposal")
    .addEventListener("click", handleSubmitProposal);

  // Proposal filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterProposals(btn.dataset.filter);
    });
  });

  // Add filter (for access request)
  document.getElementById("add-filter").addEventListener("click", addFilterRow);

  // Modals close
  document.querySelectorAll(".close").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".modal").style.display = "none";
    });
  });

  // Logs
  document.getElementById("clear-logs").addEventListener("click", () => {
    document.getElementById("event-logs").innerHTML =
      "<p class='info'>No events logged yet</p>";
  });

  document.getElementById("refresh-logs").addEventListener("click", () => {
    showSuccess("Logs refreshed");
  });
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  document.getElementById(`tab-${tabName}`).classList.add("active");
}

// ================= DATASETS =================

async function loadDatasets() {
  if (!contract) return;

  const container = document.getElementById("datasets-list");
  container.innerHTML = "<p class='loading'>Loading datasets...</p>";

  try {
    const count = (await contract.datasetCount()).toNumber();
    console.log("datasetCount:", count);

    if (count === 0) {
      container.innerHTML = "<p class='info'>No datasets found</p>";
      updateDatasetSelector(0);
      return;
    }

    container.innerHTML = "";

    // Contract uses 0-based dataset IDs: [0..datasetCount-1]
    for (let id = 0; id < count; id++) {
      const ds = await contract.getDataset(id);

      // (uint256 datasetId, string name, address[] owners, uint256 createdAt)
      const [datasetId, name, owners, createdAt] = ds;
      const createdMs = createdAt.toNumber() * 1000;

      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="card-title">${name}</div>
            <small>Dataset ID: ${datasetId}</small>
          </div>
          <button class="btn btn-secondary" onclick="viewDataset(${datasetId})">View</button>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="info-label">Owners:</span>
            <span class="info-value">${owners.length}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Created:</span>
            <span class="info-value">${new Date(createdMs).toLocaleString()}</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    }

    updateDatasetSelector(count);
  } catch (err) {
    console.error("Failed to load datasets:", err);
    container.innerHTML = "<p class='error'>Failed to load datasets</p>";
  }
}

function updateDatasetSelector(count) {
  const sel = document.getElementById("proposal-dataset");
  sel.innerHTML = '<option value="">-- Select Dataset --</option>';

  for (let id = 0; id < count; id++) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `Dataset #${id}`;
    sel.appendChild(opt);
  }
}

async function viewDataset(datasetId) {
  const modal = document.getElementById("dataset-modal");
  const details = document.getElementById("modal-dataset-details");

  try {
    const ds = await contract.getDataset(datasetId);
    const [id, name, owners, createdAt] = ds;
    const createdMs = createdAt.toNumber() * 1000;

    document.getElementById("modal-dataset-name").textContent = name;

    details.innerHTML = `
      <div class="info-row">
        <span class="info-label">ID:</span><span>${id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Name:</span><span>${name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Created:</span><span>${new Date(createdMs).toLocaleString()}</span>
      </div>
      <h4>Owners:</h4>
      <ul>${owners.map((o) => `<li>${o}</li>`).join("")}</ul>
    `;

    modal.style.display = "block";
  } catch (err) {
    console.error("Failed to load dataset:", err);
    showError("Failed to load dataset details");
  }
}

// ================= PROPOSALS =================

async function loadProposals() {
  if (!contract) return;

  const container = document.getElementById("proposals-list");
  container.innerHTML = "<p class='loading'>Loading proposals...</p>";

  try {
    const count = (await contract.proposalCount()).toNumber();
    console.log("proposalCount:", count);

    if (count === 0) {
      container.innerHTML = "<p class='info'>No proposals created yet</p>";
      return;
    }

    container.innerHTML = "";

    const types = ["Onboard Owner", "Revoke Owner", "Ingest Request", "Access Request"];
    const stateLabels = ["pending", "executed", "rejected"];
    const stateBadges = ["badge-pending", "badge-executed", "badge-rejected"];

    // proposal IDs: [0..proposalCount-1]
    for (let id = 0; id < count; id++) {
      const p = await contract.getProposal(id);
      const [
        proposalId,
        proposalType,
        datasetId,
        targetAddress,
        metadata,
        proposer,
        state,
        adminVotes,
        ownerVotes,
        createdAt
      ] = p;

      const createdMs = createdAt.toNumber() * 1000;

      const card = document.createElement("div");
      card.className = "card";
      card.dataset.proposalId = proposalId;
      card.dataset.state = state;

      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="card-title">Proposal #${proposalId}: ${types[proposalType]}</div>
            <small>Dataset ID: ${datasetId}</small>
          </div>
          <span class="badge ${stateBadges[state]}">${stateLabels[state]}</span>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="info-label">Proposer:</span>
            <span class="info-value">${proposer.substring(0,10)}...${proposer.substring(38)}</span>
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
            <span class="info-value">${new Date(createdMs).toLocaleString()}</span>
          </div>
          <div style="margin-top: 15px;">
            <button class="btn btn-secondary" onclick="viewProposal(${proposalId})">View Details</button>
            ${
              state === 0
                ? `<button class="btn btn-success" onclick="voteOnProposal(${proposalId})">Vote</button>`
                : ""
            }
          </div>
        </div>
      `;

      container.appendChild(card);
    }
  } catch (err) {
    console.error("Failed to load proposals:", err);
    container.innerHTML = "<p class='error'>Failed to load proposals</p>";
  }
}

async function viewProposal(proposalId) {
  const modal = document.getElementById("proposal-modal");
  const details = document.getElementById("modal-proposal-details");
  const votingSection = document.getElementById("modal-voting-section");

  try {
    const p = await contract.getProposal(proposalId);
    const hasVoted = await contract.hasVotedOnProposal(proposalId, currentAccount);

    const types = ["Onboard Owner", "Revoke Owner", "Ingest Request", "Access Request"];
    const states = ["Pending", "Executed", "Rejected"];

    const [
      id,
      proposalType,
      datasetId,
      targetAddress,
      metadata,
      proposer,
      state,
      adminVotes,
      ownerVotes,
      createdAt
    ] = p;

    let metadataHtml;
    try {
      const obj = JSON.parse(metadata);
      metadataHtml = `
        <pre style="background:#f8f9fa;padding:15px;border-radius:6px;overflow-x:auto;">
${JSON.stringify(obj, null, 2)}
        </pre>
      `;
    } catch {
      metadataHtml = `<p>${metadata}</p>`;
    }

    details.innerHTML = `
      <div class="info-row">
        <span class="info-label">Proposal ID:</span><span>${id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Type:</span><span>${types[proposalType]}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Dataset ID:</span><span>${datasetId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status:</span><span>${states[state]}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Proposer:</span><span>${proposer}</span>
      </div>
      ${
        targetAddress !== ethers.constants.AddressZero
          ? `<div class="info-row">
               <span class="info-label">Target Address:</span><span>${targetAddress}</span>
             </div>`
          : ""
      }
      <div class="info-row">
        <span class="info-label">Admin Votes:</span><span>${adminVotes}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Owner Votes:</span><span>${ownerVotes}</span>
      </div>
      <div style="margin-top:20px;">
        <strong>Metadata:</strong>
        ${metadataHtml}
      </div>
    `;

    if (state === 0) {
      votingSection.innerHTML = `
        <div style="margin-top:20px;padding-top:20px;border-top:2px solid #e9ecef;">
          <h3>Vote on this Proposal</h3>
          ${
            hasVoted
              ? "<p class='info'>You have already voted on this proposal</p>"
              : `<button class="btn btn-success"
                        onclick="voteOnProposal(${id});document.getElementById('proposal-modal').style.display='none';">
                   Cast Vote
                 </button>`
          }
        </div>
      `;
    } else {
      votingSection.innerHTML = "";
    }

    modal.style.display = "block";
  } catch (err) {
    console.error("Failed to load proposal details:", err);
    showError("Failed to load proposal details");
  }
}

async function voteOnProposal(proposalId) {
  try {
    showInfo("Submitting vote...");
    const tx = await contract.voteOnProposal(proposalId);
    showInfo("Waiting for confirmation...");
    await tx.wait();
    showSuccess("Vote submitted");
    await loadProposals();
  } catch (err) {
    console.error("Vote failed:", err);
    showError("Failed to vote: " + (err.reason || err.message));
  }
}

function filterProposals(filter) {
  const cards = document.querySelectorAll("#proposals-list .card");
  cards.forEach((card) => {
    const state = card.dataset.state;
    if (filter === "all") card.style.display = "block";
    else if (filter === "pending" && state === "0") card.style.display = "block";
    else if (filter === "executed" && state === "1") card.style.display = "block";
    else if (filter === "rejected" && state === "2") card.style.display = "block";
    else card.style.display = "none";
  });
}

// ================= CREATE DATASET (ONCHAIN + SCHEMA TO BACKEND) =================

async function handleCreateDataset(e) {
  e.preventDefault();

  try {
    const name = document.getElementById("dataset-name").value.trim();
    const ownersText = document.getElementById("initial-owners").value;
    const owners = ownersText.split(",").map((a) => a.trim()).filter(Boolean);

    if (!name) {
      showError("Dataset name is required");
      return;
    }
    if (!owners.length) {
      showError("At least one owner is required");
      return;
    }
    for (const o of owners) {
      if (!ethers.utils.isAddress(o)) {
        showError(`Invalid address: ${o}`);
        return;
      }
    }

    const schema = getSchemaFromBuilder();
    if (!schema.columns.length) {
      showError("Define at least one schema column");
      return;
    }

    showInfo("Creating dataset on-chain...");
    const tx = await contract.createDataset(name, owners);
    showInfo("Waiting for confirmation...");
    const receipt = await tx.wait();

    const evt = receipt.events.find((e) => e.event === "DatasetCreated");
    if (!evt) {
      showError("Dataset created but event not found");
      return;
    }
    const datasetId = evt.args.datasetId.toNumber(); // 0-based

    showSuccess(`Dataset created with ID ${datasetId}`);

    // Persist schema to backend
    try {
      const resp = await fetch(`${BACKEND_BASE_URL}/schemas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId, schema }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        console.error("Schema save error:", data);
        showError("Dataset created but failed to save schema off-chain");
      } else {
        showInfo("Schema saved to backend");
      }
    } catch (err) {
      console.error("Schema save request failed:", err);
      showError("Dataset created but schema save failed");
    }

    // Reset form
    document.getElementById("create-dataset-form").reset();
    document.getElementById("schema-builder").innerHTML = createSchemaColumn();
    document
      .querySelectorAll("#schema-builder .btn-remove-col")
      .forEach((btn) => {
        btn.addEventListener("click", function () {
          this.closest(".schema-column").remove();
        });
      });

    await loadDatasets();
  } catch (err) {
    console.error("Create dataset error:", err);
    showError("Failed to create dataset: " + (err.reason || err.message));
  }
}

// ================= SCHEMA BUILDER =================

function addSchemaColumn() {
  const builder = document.getElementById("schema-builder");
  builder.insertAdjacentHTML("beforeend", createSchemaColumn());
  const lastBtn = builder.querySelector(".schema-column:last-child .btn-remove-col");
  lastBtn.addEventListener("click", function () {
    this.closest(".schema-column").remove();
  });
}

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

function getSchemaFromBuilder() {
  const cols = [];
  document.querySelectorAll("#schema-builder .schema-column").forEach((col) => {
    const name = col.querySelector(".col-name").value.trim();
    const type = col.querySelector(".col-type").value;
    if (name) cols.push({ name, type });
  });
  return { columns: cols };
}

// ================= PROPOSAL FORM BEHAVIOUR =================

function handleProposalTypeChange() {
  const type = document.getElementById("proposal-type").value;

  document.querySelectorAll(".conditional-form").forEach((f) => (f.style.display = "none"));

  if (type === "0" || type === "1") {
    document.getElementById("owner-proposal-form").style.display = "block";
  } else if (type === "2") {
    document.getElementById("ingestion-proposal-form").style.display = "block";
  } else if (type === "3") {
    document.getElementById("access-proposal-form").style.display = "block";
  }
}

async function handleDatasetChange() {
  const datasetId = document.getElementById("proposal-dataset").value;
  const proposalType = document.getElementById("proposal-type").value;

  if (proposalType === "3" && datasetId !== "") {
    try {
      const schema = await fetchSchema(datasetId);
      populateColumnSelector(schema);
    } catch (err) {
      console.error("Schema fetch error:", err);
      showError("Failed to load schema for dataset");
    }
  }
}

// ================= SCHEMA FETCH FROM BACKEND =================

async function fetchSchema(datasetId) {
  if (schemaCache[datasetId]) return schemaCache[datasetId];

  const resp = await fetch(`${BACKEND_BASE_URL}/schema/${datasetId}`);
  if (!resp.ok) throw new Error("Schema not found for dataset " + datasetId);
  const data = await resp.json();
  schemaCache[datasetId] = data.schema;
  return data.schema;
}

function populateColumnSelector(schema) {
  const selector = document.getElementById("column-selector");
  if (!schema || !schema.columns || !schema.columns.length) {
    selector.innerHTML = "<p class='error'>No columns defined for this dataset</p>";
    return;
  }

  selector.innerHTML = schema.columns
    .map(
      (col) => `
      <div class="column-checkbox">
        <input type="checkbox" id="col-${col.name}" value="${col.name}">
        <label for="col-${col.name}">${col.name} (${col.type})</label>
      </div>
    `
    )
    .join("");

  const fb = document.getElementById("filter-builder");
  fb.innerHTML = `
    <button type="button" id="add-filter" class="btn btn-secondary">+ Add Filter</button>
  `;
  document.getElementById("add-filter").addEventListener("click", addFilterRow);
}

function addFilterRow() {
  const datasetId = document.getElementById("proposal-dataset").value;
  if (datasetId === "") {
    showError("Select a dataset before adding filters");
    return;
  }

  const schema = schemaCache[datasetId];
  if (!schema || !schema.columns || !schema.columns.length) {
    showError("Schema not loaded for selected dataset");
    return;
  }

  const fb = document.getElementById("filter-builder");
  const row = document.createElement("div");
  row.className = "filter-row";

  const columnOptions = schema.columns
    .map((c) => `<option value="${c.name}">${c.name}</option>`)
    .join("");

  row.innerHTML = `
    <select class="filter-column">
      <option value="">Select Column</option>
      ${columnOptions}
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
    <button type="button" class="btn-remove-col">×</button>
  `;

  row.querySelector(".btn-remove-col").addEventListener("click", () => row.remove());
  fb.appendChild(row);
}

function buildRowFilterExpression() {
  const rows = document.querySelectorAll("#filter-builder .filter-row");
  const clauses = [];

  rows.forEach((row) => {
    const col = row.querySelector(".filter-column").value;
    const op = row.querySelector(".filter-operator").value;
    const valRaw = row.querySelector(".filter-value").value.trim();

    if (!col || !op || !valRaw) return;

    if (op === "IN") {
      const parts = valRaw.split(",").map((v) => v.trim()).filter(Boolean);
      const list = parts.map((p) => `'${p.replace(/'/g, "''")}'`).join(", ");
      clauses.push(`${col} IN (${list})`);
    } else {
      const numeric = !isNaN(Number(valRaw));
      const val = numeric ? valRaw : `'${valRaw.replace(/'/g, "''")}'`;
      clauses.push(`${col} ${op} ${val}`);
    }
  });

  return clauses.join(" AND ");
}

// ================= SUBMIT PROPOSAL (ALL TYPES) =================

async function handleSubmitProposal(e) {
  e.preventDefault();

  if (!contract) {
    showError("Connect your wallet first");
    return;
  }

  const type = document.getElementById("proposal-type").value;
  const datasetIdVal = document.getElementById("proposal-dataset").value;

  if (type === "") {
    showError("Select proposal type");
    return;
  }
  if (datasetIdVal === "") {
    showError("Select dataset");
    return;
  }

  const datasetId = parseInt(datasetIdVal, 10);

  let targetAddress = ethers.constants.AddressZero;
  let metadata = {};

  try {
    if (type === "0" || type === "1") {
      // Onboard / Revoke owner
      const addr = document.getElementById("target-address").value.trim();
      if (!ethers.utils.isAddress(addr)) {
        showError("Invalid target address");
        return;
      }
      targetAddress = addr;
      metadata = {
        kind: type === "0" ? "onboard_owner" : "revoke_owner",
        targetAddress: addr,
      };
    } else if (type === "2") {
      // Ingestion request (metadata only for now)
      const filename = document.getElementById("filename").value.trim();
      const format = document.getElementById("file-format").value;
      const purpose = document.getElementById("ingestion-purpose").value.trim();

      if (!filename || !format || !purpose) {
        showError("Filename, format and purpose are required");
        return;
      }

      metadata = {
        kind: "ingestion",
        filename,
        format,
        purpose,
        hasFile: false,
      };
    } else if (type === "3") {
      // Column / Row access request
      const requesterAddress = document.getElementById("requester-address").value.trim();
      if (!ethers.utils.isAddress(requesterAddress)) {
        showError("Invalid requester address");
        return;
      }

      const selectedCols = Array.from(
        document.querySelectorAll("#column-selector input[type='checkbox']:checked")
      ).map((chk) => chk.value);

      if (!selectedCols.length) {
        showError("Select at least one column");
        return;
      }

      const limitVal = document.getElementById("result-limit").value || "10000";
      const limit = parseInt(limitVal, 10);
      const accessPurpose = document.getElementById("access-purpose").value.trim();
      const justification = document.getElementById("justification").value.trim();
      const rowFilter = buildRowFilterExpression();

      if (!accessPurpose || !justification) {
        showError("Purpose and justification are required");
        return;
      }

      metadata = {
        kind: "access",
        requester: requesterAddress,
        columns: selectedCols,
        row_filter: rowFilter || null,
        limit,
        purpose: accessPurpose,
        justification,
      };

      targetAddress = requesterAddress;
    }

    showInfo("Creating proposal on-chain...");

    const tx = await contract.createProposal(
      parseInt(type, 10),
      datasetId,
      targetAddress,
      JSON.stringify(metadata) // single stringify only
    );

    showInfo("Waiting for confirmation...");
    const receipt = await tx.wait();

    const evt = receipt.events.find((e) => e.event === "ProposalCreated");
    const proposalId = evt ? evt.args.proposalId.toNumber() : null;

    if (proposalId !== null) {
      showSuccess(`Proposal #${proposalId} created`);
    } else {
      showSuccess("Proposal created");
    }

    await loadProposals();
    switchTab("proposals");
  } catch (err) {
    console.error("Create proposal error:", err);
    showError("Failed to create proposal: " + (err.reason || err.message));
  }
}

// ================= CONTRACT EVENT LISTENERS =================

function setupContractEventListeners() {
  if (!contract) return;

  contract.on("DatasetCreated", async (datasetId, name, creator, ts) => {
    logEvent("DatasetCreated", {
      datasetId: datasetId.toString(),
      name,
      creator,
    });
    await loadDatasets();
  });

  contract.on(
    "ProposalCreated",
    async (proposalId, proposalType, datasetId, proposer, metadata, ts) => {
      logEvent("ProposalCreated", {
        proposalId: proposalId.toString(),
        proposalType,
        datasetId: datasetId.toString(),
        proposer,
      });
      await loadProposals();
    }
  );

  contract.on("ProposalVoted", async (proposalId, voter, isAdmin, ts) => {
    logEvent("ProposalVoted", {
      proposalId: proposalId.toString(),
      voter,
      isAdmin,
    });
    await loadProposals();
  });

  contract.on("ProposalExecuted", async (proposalId, proposalType, datasetId, ts) => {
    logEvent("ProposalExecuted", {
      proposalId: proposalId.toString(),
      proposalType,
      datasetId: datasetId.toString(),
    });
    await loadProposals();
  });

  contract.on("IngestionApproved", (proposalId, datasetId, metadata, ts) => {
    logEvent("IngestionApproved", {
      proposalId: proposalId.toString(),
      datasetId: datasetId.toString(),
    });
  });

  contract.on(
    "ColumnRowAccessGranted",
    (proposalId, datasetId, grantee, metadata, ts) => {
      logEvent("ColumnRowAccessGranted", {
        proposalId: proposalId.toString(),
        datasetId: datasetId.toString(),
        grantee,
      });
    }
  );
}

// ================= EVENT LOGGING UI =================

function logEvent(name, data) {
  const logsDiv = document.getElementById("event-logs");
  if (logsDiv.querySelector(".info")) logsDiv.innerHTML = "";

  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `
    <div class="log-timestamp">${new Date().toLocaleString()}</div>
    <strong>${name}</strong>
    <div style="margin-top:5px;"><pre>${JSON.stringify(data, null, 2)}</pre></div>
  `;
  logsDiv.prepend(entry);
}

// ================= MESSAGE / BANNER HELPERS =================

function showError(msg) {
  showMessage(msg, "error");
}

function showSuccess(msg) {
  showMessage(msg, "success");
}

function showInfo(msg) {
  showMessage(msg, "info");
}

function showMessage(message, type) {
  document.querySelectorAll(".message-banner").forEach((el) => el.remove());

  const banner = document.createElement("div");
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

  if (type === "error") {
    banner.style.background = "#f8d7da";
    banner.style.color = "#721c24";
    banner.style.border = "1px solid #f5c6cb";
  } else if (type === "success") {
    banner.style.background = "#d4edda";
    banner.style.color = "#155724";
    banner.style.border = "1px solid #c3e6cb";
  } else {
    banner.style.background = "#d1ecf1";
    banner.style.color = "#0c5460";
    banner.style.border = "1px solid #bee5eb";
  }

  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 5000);
}

// ================= BOOTSTRAP =================

window.addEventListener("load", init);
