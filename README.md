# ERC-20 TOKEN AIRDROP DASHBOARD

[![Verified on Etherscan](https://img.shields.io/badge/Etherscan-Verified-brightgreen)](https://sepolia.etherscan.io/address/0x1e79DE344A8B99CAF74E60dc1bD7cCE26e9f5524#code)

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Ethers.js](https://img.shields.io/badge/Ethers.js-5.8-purple)
![Network](https://img.shields.io/badge/Network-Sepolia-green)

Built by [Kyle Tredway Development](https://kyle-tredway-portfolio.netlify.app/) — professional Solidity smart contract packages for Web3 companies.

A production-ready React frontend for interacting with a deployed ERC-20 Merkle airdrop contract.

> ⚠️ This dashboard is connected to the Sepolia test network for demonstration purposes only.
> These contracts have not been professionally audited. A full security audit is strongly recommended before any mainnet deployment.

This project demonstrates the full lifecycle of a Merkle airdrop management dashboard including:

- Wallet connection and network validation
- Real-time airdrop data loaded from the blockchain
- Merkle proof verification handled automatically behind the scenes
- Role-based admin controls
- Transaction feedback with Etherscan verification

The repository represents the frontend layer of an ERC-20 Merkle Airdrop package, designed to work alongside the ERC-20 Token Launch Contract and ERC-20 Token Vesting Contract as part of the full Dominate package.


## PROJECT GOALS

The purpose of this project is to demonstrate how a modern Merkle airdrop dashboard should be designed for real-world use.

The dashboard includes common features required by token airdrop interfaces:

- Live airdrop data loaded from the blockchain
- Automatic Merkle proof lookup by connected wallet address
- Wallet-based role detection
- Protected admin functions
- Live countdown timer showing exact time remaining to claim
- User-friendly transaction status and error handling
- Etherscan transaction verification

These patterns are widely used in production Web3 applications.


## DASHBOARD FEATURES

### WALLET CONNECTION

The dashboard connects to MetaMask and automatically detects the connected wallet's roles.
A network check ensures the user is on the correct chain before connecting.
The UI refreshes automatically when the wallet is switched inside MetaMask.

### LIVE AIRDROP DATA

On connection, the dashboard loads the following data directly from the contract:

- Contract Balance — tokens currently held in the airdrop contract
- Total Claimed — total tokens claimed across all wallets so far
- Claim Deadline — live countdown showing exact time remaining to claim

### MY AIRDROP STATUS

The dashboard automatically checks the connected wallet against the whitelist and displays one of four states:

| State | Description |
|-------|-------------|
| ✓ Eligible | Wallet is on the whitelist and can claim |
| ✓ Airdrop Claimed | Wallet has already successfully claimed |
| ❌ Not Eligible | Wallet is not on the airdrop whitelist |
| ⚠️ Claim Period Ended | Wallet was eligible but the deadline has passed |

### CLAIM TOKENS

Eligible wallets can claim their full allocation in one click. The Merkle proof is looked up automatically from the bundled proofs file — users never need to handle proofs themselves. The claim button is disabled when the airdrop is paused or after the deadline passes.

### ROLE-BASED ADMIN PANEL

The admin panel is only visible to wallets holding the ADMIN_ROLE or PAUSER_ROLE.
Non-admin wallets see only their own airdrop status.

Admin functions include:

| Function | Description |
|----------|-------------|
| Update Merkle Root | Update the on-chain whitelist with a new Merkle root |
| Update Claim Deadline | Extend the airdrop deadline to a future date |
| Recover Unclaimed Tokens | Recover all remaining tokens after the deadline passes |
| Pause / Unpause Airdrop | Temporarily halt or resume all claims |

### UPDATE MERKLE ROOT

When a client wants to add new wallets to the whitelist:
1. Update `whitelist.json` with new addresses and amounts
2. Run `node scripts/generate-merkle.js` to get a new Merkle root and `proofs.json`
3. Paste the new Merkle root into the Update Merkle Root field
4. Update `proofs.json` in the dashboard and redeploy

### RECOVER UNCLAIMED TOKENS

After the claim deadline passes, the admin can recover all remaining unclaimed tokens back to their wallet. The Recover Tokens button is disabled until the deadline has passed and grays out once the contract balance reaches zero.

### PAUSE / UNPAUSE

The airdrop can be paused at any time to temporarily halt all claims. This is useful when updating the whitelist or responding to an emergency. The button turns green when paused to resume, and amber when active to pause.

### TRANSACTION FEEDBACK

Every action triggers a color-coded status bar with a loading spinner:

| Action | Status Color |
|--------|-------------|
| Claiming Tokens | Lime Green |
| Updating Merkle Root | Electric Purple |
| Updating Deadline | Electric Purple |
| Recovering Tokens | Dark Red |
| Pausing / Unpausing | Amber |
| Success | Bright Green |
| Error | Red |

On success, a clickable Etherscan link appears for immediate transaction verification.

### ERROR HANDLING

User-friendly error messages are displayed for common failure cases:

- Transaction rejected in MetaMask
- Insufficient funds
- Airdrop claim period has ended
- Wallet has already claimed
- Invalid Merkle proof
- Airdrop has not ended yet
- No tokens to recover
- Deadline must be in the future
- General transaction failure


## TECHNOLOGY STACK

This project was built using the following tools:

- React – Frontend framework
- Ethers.js – Contract interaction library
- MetaMask – Wallet provider
- Alchemy – Ethereum RPC provider for reads
- Tailwind CSS – Utility-first styling
- merkletreejs – Merkle tree generation library
- keccak256 – Hashing library for Merkle leaves
- Sepolia Test Network – Deployment environment


## PROJECT STRUCTURE

```
src/
    App.js
    App.css
    index.js
    proofs.json
    contracts/
        TokenAirdrop.json
        sepolia.json

merkle/
    whitelist.json
    proofs.json
    merkle-root.json

scripts/
    generate-merkle.js
    deploy-token.js
    deploy-airdrop.js
    fund-airdrop.js

public/
    index.html

.env
```

### APP.JS

Contains all wallet connection logic, contract interaction, and UI rendering.

### PROOFS.JSON

Contains the Merkle proof for every whitelisted wallet address. Bundled into the dashboard at build time. The dashboard automatically looks up the connected wallet's proof — users never interact with proofs directly.

### MERKLE FOLDER

Contains the whitelist input file, generated proofs, and Merkle root used during deployment and updates.

### SCRIPTS

Contains the Merkle tree generation script and deployment scripts.

### ENV

Contains the Alchemy RPC URL used for all read operations.


## INSTALLATION

### CLONE THE REPOSITORY:

```bash
git clone https://github.com/Ktredway0128/erc20-airdrop-dashboard
cd erc20-airdrop-dashboard
```

### INSTALL DEPENDENCIES:

```bash
npm install
```

### START THE DEVELOPMENT SERVER:

```bash
npm start
```


## ENVIRONMENT SETUP

Create a `.env` file in the root directory:

```
REACT_APP_ALCHEMY_URL=YOUR_SEPOLIA_ALCHEMY_URL
```

This value allows the dashboard to:

- Read airdrop data directly from the blockchain via Alchemy
- Bypass MetaMask's RPC for all read operations


## MERKLE TREE WORKFLOW

The airdrop uses a Merkle tree to verify eligibility without storing all addresses on-chain.

### STEP 1 — Define the whitelist:

Edit `merkle/whitelist.json` with wallet addresses and token amounts:

```json
[
    { "address": "0xAbc...", "amount": "500" },
    { "address": "0xDef...", "amount": "1000" }
]
```

### STEP 2 — Generate the Merkle tree:

```bash
node scripts/generate-merkle.js
```

This outputs `merkle/merkle-root.json` and `merkle/proofs.json`.

### STEP 3 — Deploy the contract:

```bash
npx hardhat run scripts/deploy-airdrop.js --network sepolia
```

### STEP 4 — Copy proofs to the dashboard:

Copy `merkle/proofs.json` into `src/proofs.json` and redeploy the dashboard.


## HOW TO USE

### CONNECTING YOUR WALLET

1. Make sure MetaMask is installed in your browser
2. Switch MetaMask to the **Sepolia** test network
3. Click **Connect Wallet**
4. Approve the connection in MetaMask

### CLAIMING YOUR AIRDROP (Eligible Wallet)

1. Connect with an eligible wallet
2. Your allocation and time remaining will display automatically
3. Click **Claim X STK**
4. Confirm the transaction in MetaMask
5. Your tokens will appear in your wallet after confirmation

### UPDATING THE WHITELIST (Admin Only)

1. Add new addresses to `merkle/whitelist.json`
2. Run `node scripts/generate-merkle.js`
3. Pause the airdrop in the Admin Panel
4. Paste the new Merkle root into **Update Merkle Root** and confirm
5. Copy new `merkle/proofs.json` into `src/proofs.json` and redeploy the dashboard
6. Unpause the airdrop

### RECOVERING TOKENS (Admin Only)

1. Wait for the claim deadline to pass
2. Connect with the admin wallet
3. Click **Recover Tokens** — all remaining tokens are sent to the admin wallet
4. The button automatically grays out once the contract balance reaches zero


## PROVIDER ARCHITECTURE

The dashboard uses a dual-provider setup for optimal performance and reliability:

| Provider | Purpose |
|----------|---------|
| MetaMask (Web3Provider) | Signs and broadcasts all write transactions |
| Alchemy (JsonRpcProvider) | Handles all read operations |

This separation ensures reads are fast and reliable while writes are always signed by the user's wallet.


## SEPOLIA TESTNET DEPLOYMENT

| Contract | Address | Etherscan |
|----------|---------|-----------|
| SampleToken | `0x036150039c33b1645080a9c913f96D4c65ccca48` | [View on Etherscan](https://sepolia.etherscan.io/address/0x036150039c33b1645080a9c913f96D4c65ccca48#code) |
| TokenAirdrop | `0x1e79DE344A8B99CAF74E60dc1bD7cCE26e9f5524` | [View on Etherscan](https://sepolia.etherscan.io/address/0x1e79DE344A8B99CAF74E60dc1bD7cCE26e9f5524#code) |

Deployed: 2026-03-19

Merkle Root: `0x4b5c2800591b44919b0eadb6c6e42d649e0694a805266ae22df72091daafe0c6`


## EXAMPLE TOKEN CONFIGURATION

Example parameters used with this dashboard:

- Token Name: Sample Token
- Token Symbol: STK
- Maximum Supply: 1,000,000 tokens
- Initial Supply: 100,000 tokens


## SECURITY PRACTICES

The dashboard enforces security at two levels:

**UI Level**
- Admin panel is hidden from non-admin wallets
- Network check prevents connection on wrong chain
- Input validation prevents invalid transactions
- Merkle proofs are verified on-chain — the dashboard cannot fabricate eligibility

**Contract Level**
- All role checks are enforced by the smart contract
- The UI is a convenience layer — the contract is the source of truth
- No transaction can bypass the contract's access control
- Double claim protection prevents any wallet from claiming more than once
- Merkle proof verification ensures only whitelisted wallets can claim


## EXAMPLE USE CASES

This dashboard architecture can support many types of projects:

- Community token airdrops for early users and contributors
- DAO governance token distribution
- Startup equity token launches
- Game economy token distributions
- DeFi protocol token distributions
- Loyalty rewards programs


## FUTURE ENHANCEMENTS

This dashboard serves as the third frontend layer in a larger Web3 infrastructure package.

Possible upgrades include:

- IPFS-hosted proofs for very large whitelists
- Active claimant list for admins
- Claim analytics and reporting
- Multi-wallet admin management
- Mainnet deployment


## AUTHOR

Kyle Tredway

Smart Contract Developer / Token Launch Specialist


## LICENSE

MIT License