# TOKEN CROWDSALE DASHBOARD

[![Verified on Etherscan](https://img.shields.io/badge/Etherscan-Verified-brightgreen)](https://sepolia.etherscan.io/address/0xb19f657E2CB2ea593a348285230D3827c85Ae3c5#code)

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Ethers.js](https://img.shields.io/badge/Ethers.js-5.8-purple)
![Network](https://img.shields.io/badge/Network-Sepolia-green)

Built by [Tredway Development](https://kyle-tredway-portfolio.netlify.app/) — professional Solidity smart contract packages for Web3 companies.

A production-ready React frontend for interacting with a deployed ERC-20 token crowdsale contract.

> ⚠️ This dashboard is connected to the Sepolia test network for demonstration purposes only.
> These contracts have not been professionally audited. A full security audit is strongly recommended before any mainnet deployment.

This project demonstrates the full lifecycle of a token crowdsale management dashboard including:

- Wallet connection and network validation
- Real-time sale data loaded from the blockchain
- Merkle proof verification handled automatically behind the scenes
- ETH-based token purchases with live progress tracking
- Purchaser vesting with cliff period enforcement
- Soft cap and hard cap monitoring
- Refund claiming on failed raises
- Role-based admin controls
- Transaction feedback with Etherscan verification

The repository represents the frontend layer of an ERC-20 Token Crowdsale package, designed to work alongside the ERC-20 Token Launch Contract as part of the full infrastructure suite.


## PROJECT GOALS

The purpose of this project is to demonstrate how a modern token crowdsale dashboard should be designed for real-world use.

The dashboard includes common features required by token sale interfaces:

- Live sale data loaded from the blockchain
- Automatic Merkle proof lookup by connected wallet address
- Real-time raise progress bar with soft cap and hard cap indicators
- Wallet-based role detection
- Protected admin functions
- Purchaser vesting tracking with cliff period display
- User-friendly transaction status and error handling
- Etherscan transaction verification

These patterns are widely used in production Web3 token launches.


## DASHBOARD FEATURES

### WALLET CONNECTION

The dashboard connects to MetaMask and automatically detects the connected wallet's roles.
A network check ensures the user is on the correct chain before connecting.
The UI refreshes automatically when the wallet is switched inside MetaMask.

### LIVE SALE DATA

On connection, the dashboard loads the following data directly from the contract:

- Total Raised — ETH raised so far across all buyers
- Cap — soft cap and hard cap displayed together
- Token Pool — tokens currently held in the crowdsale contract
- Total Tokens Sold — total tokens distributed to buyers so far
- My Tokens — tokens purchased by the connected wallet

### SALE PROGRESS CARD

The sale progress card shows the current sale state and raise progress:

- Sale Status — Not Started, Active with live countdown, Ended, or Finalized
- End Date — when the sale period closes
- Raise Progress — visual progress bar showing ETH raised toward the hard cap
- Soft Cap indicator — updates to ✓ Reached when the soft cap is hit
- Hard Cap indicator — updates to ✓ Reached when the hard cap is hit
- Rate — tokens per ETH displayed inline

### SALE DETAILS CARD

A static reference card showing all sale parameters:

- Sale Duration
- Minimum Contribution
- Maximum Contribution
- Cliff Period
- Vesting Duration

### BUY TOKENS

Whitelisted wallets can purchase tokens during an active sale. The buyer enters an ETH amount and submits a single transaction — no prior token approval is required. The Merkle proof is looked up automatically from the bundled proofs file. The buy button is disabled when the sale is paused or inactive.

### MY POSITION

After purchasing, the My Position card appears showing the buyer's full status:

| Field | Description |
|-------|-------------|
| My Contribution | Total ETH contributed by this wallet |
| Tokens Purchased | Total tokens bought across all purchases |
| Tokens Claimed | Tokens already claimed from vesting |
| Claimable Now | Tokens currently available to claim |

A vesting explanation is shown below the stats reminding the buyer of their cliff period and vesting duration. After the sale is finalized buyers can claim tokens as they vest or claim a refund if the soft cap was not reached.

### CLAIM TOKENS

After the sale is finalized and the soft cap was reached, buyers can claim their vested tokens. Tokens vest linearly over the vesting duration starting from the buyer's individual purchase timestamp. The cliff period must pass before any tokens become claimable. Buyers can claim multiple times as additional tokens vest over time.

### CLAIM REFUND

If the soft cap was not reached after finalization, buyers can claim a full ETH refund. The refund button shows the exact ETH amount to be returned. Each wallet can only claim its refund once.

### NOT WHITELISTED

If a wallet connects during an active sale but is not on the whitelist, a clear Not Whitelisted message is shown and the buy interface is hidden.

### ROLE-BASED ADMIN PANEL

The admin panel is only visible to wallets holding the ADMIN_ROLE. Non-admin wallets see only their own purchase status.

Admin functions include:

| Function | Description |
|----------|-------------|
| Recover Tokens | Recover accidentally sent tokens — cannot recover the sale token |
| Start Sale | Start the token sale period |
| Finalize Sale | Close the sale and distribute ETH or enable refunds |
| Pause / Unpause Sale | Temporarily halt or resume all purchases |

### FINALIZE SALE

After the sale period ends or the hard cap is reached the admin can finalize the sale. If the soft cap was reached all raised ETH is sent to the admin wallet. If the soft cap was not reached ETH stays in the contract and buyers can claim refunds. A warning message appears when the sale ends without reaching the soft cap so the admin knows what to expect before finalizing.

### PAUSE / UNPAUSE

The sale can be paused at any time to temporarily halt all purchases. Vesting claims and refund claims remain available while paused. The button turns green when paused to resume and amber when active to pause.

### TRANSACTION FEEDBACK

Every action triggers a color-coded status bar with a loading spinner:

| Action | Status Color |
|--------|-------------|
| Buying Tokens | Royal Blue |
| Claiming Tokens | Royal Blue |
| Claiming Refund | Orange |
| Admin Actions | Royal Blue |
| Success | Bright Green |
| Error | Red |

On success a clickable Etherscan link appears for immediate transaction verification.

### ERROR HANDLING

User-friendly error messages are displayed for common failure cases:

- Transaction rejected in MetaMask
- Insufficient funds
- Wallet not on the whitelist
- Below minimum contribution
- Exceeds maximum contribution
- Purchase would exceed the hard cap
- Sale has not started yet
- Sale has ended
- Sale has been finalized
- Soft cap not reached — refund available
- No tokens purchased
- No tokens available to claim yet
- No contribution found
- Refund already claimed
- Sale not finalized yet
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
        TokenCrowdsale.json
        sepolia.json

public/
    index.html

.env
```

### APP.JS

Contains all wallet connection logic, contract interaction, and UI rendering.

### PROOFS.JSON

Contains the Merkle proof for every whitelisted wallet address. Bundled into the dashboard at build time. The dashboard automatically looks up the connected wallet's proof — users never interact with proofs directly.

### ENV

Contains the Alchemy RPC URL used for all read operations.


## INSTALLATION

### CLONE THE REPOSITORY:

```bash
git clone https://github.com/Ktredway0128/token-crowdsale-dashboard
cd token-crowdsale-dashboard
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

- Read sale data directly from the blockchain via Alchemy
- Bypass MetaMask's RPC for all read operations


## MERKLE TREE WORKFLOW

The crowdsale uses a Merkle tree to verify buyer eligibility without storing all addresses on-chain.

### STEP 1 — Define the whitelist:

Edit the WHITELISTED_ADDRESSES array in `scripts/generate-merkle.js`:

```javascript
const WHITELISTED_ADDRESSES = [
    "0xAbc...",
    "0xDef...",
];
```

### STEP 2 — Generate the Merkle tree:

```bash
node scripts/generate-merkle.js
```

This outputs the Merkle root to the console and writes `proofs.json` directly to `src/proofs.json`.

### STEP 3 — Deploy the contract with the generated Merkle root:

```bash
npx hardhat run scripts/deploy-crowdsale.js --network sepolia
```

### STEP 4 — The proofs.json is already in place:

The generate-merkle script writes directly to the dashboard src folder — no manual copy step needed.


## HOW TO USE

### CONNECTING YOUR WALLET

1. Make sure MetaMask is installed in your browser
2. Switch MetaMask to the **Sepolia** test network
3. Click **Connect Wallet**
4. Approve the connection in MetaMask

### BUYING TOKENS (Whitelisted Wallet)

1. Connect with a whitelisted wallet during an active sale
2. Enter an ETH amount between the minimum and maximum contribution
3. Click **Buy Tokens**
4. Confirm the single transaction in MetaMask
5. Your My Position card will appear showing your purchased tokens and vesting details

### CLAIMING TOKENS (After Sale Finalization)

1. Wait for the sale to be finalized and your cliff period to expire
2. Connect with your buyer wallet
3. Click **Claim Tokens** to claim all currently vested tokens
4. Come back periodically to claim more as additional tokens vest

### CLAIMING A REFUND (If Soft Cap Not Reached)

1. Wait for the sale to be finalized
2. Connect with your buyer wallet
3. If the soft cap was not reached a refund button will appear showing your ETH amount
4. Click **Claim Refund** and confirm in MetaMask
5. Your full ETH contribution is returned to your wallet

### STARTING THE SALE (Admin Only)

1. Connect with the admin wallet
2. Confirm the contract is funded with enough tokens to cover the hard cap
3. Click **Start Sale** in the Admin Panel
4. The sale period begins immediately and runs for the configured duration

### FINALIZING THE SALE (Admin Only)

1. Wait for the sale period to end or the hard cap to be reached
2. Connect with the admin wallet
3. Click **Finalize Sale** in the Admin Panel
4. If the soft cap was reached ETH is sent to the admin wallet
5. If not buyers can now claim refunds


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
| TokenCrowdsale | `0xb19f657E2CB2ea593a348285230D3827c85Ae3c5` | [View on Etherscan](https://sepolia.etherscan.io/address/0xb19f657E2CB2ea593a348285230D3827c85Ae3c5#code) |

Deployed: 2026-04-11

Merkle Root: `0xf42831cc5ba4f7f3a25fed4059bb72a512f55cd08312864b2d7a05a94d25532e`


## EXAMPLE TOKEN CONFIGURATION

Example parameters used with this dashboard:

- Token Name: Sample Token
- Token Symbol: STK
- Rate: 1000 STK per ETH
- Hard Cap: 10 ETH
- Soft Cap: 5 ETH
- Min Contribution: 0.1 ETH
- Max Contribution: 2 ETH
- Sale Duration: 7 days
- Cliff Period: 30 days
- Vesting Duration: 180 days


## SECURITY PRACTICES

The dashboard enforces security at two levels:

**UI Level**
- Admin panel is hidden from non-admin wallets
- Network check prevents connection on wrong chain
- Input validation prevents invalid transactions
- Merkle proofs are verified on-chain — the dashboard cannot fabricate eligibility
- Whitelist check hides the buy interface from non-whitelisted wallets

**Contract Level**
- All role checks are enforced by the smart contract
- The UI is a convenience layer — the contract is the source of truth
- No transaction can bypass the contract's access control
- Hard cap enforcement prevents over-raising
- Soft cap protection ensures buyers get refunds on failed raises
- Purchaser vesting prevents immediate token dumping after the sale


## EXAMPLE USE CASES

This dashboard architecture can support many types of projects:

- Public or private token sale fundraising
- Whitelist-gated presales for early supporters
- Community token launches with fair contribution limits
- DAO treasury funding rounds
- DeFi protocol token distributions with built-in vesting
- Game economy token launches


## FUTURE ENHANCEMENTS

This dashboard serves as the fifth frontend layer in a larger Web3 infrastructure package.

Possible upgrades include:

- IPFS-hosted proofs for very large whitelists
- Buyer analytics and reporting for admins
- Multi-round sale support
- Mainnet deployment
- Governance dashboard integration


## AUTHOR

Kyle Tredway

Smart Contract Developer / Token Launch Specialist


## LICENSE

MIT License