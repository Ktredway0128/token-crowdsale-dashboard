# ERC-20 TOKEN VESTING DASHBOARD

[![Verified on Etherscan](https://img.shields.io/badge/Etherscan-Verified-brightgreen)](https://sepolia.etherscan.io/address/0x81F71D5D73383750C9d4BCe65C493A55BA887ecB#code)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Netlify-blue)](https://erc20-vesting-dashboard.netlify.app/)

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Ethers.js](https://img.shields.io/badge/Ethers.js-5.8-purple)
![Network](https://img.shields.io/badge/Network-Sepolia-green)

Built by [Kyle Tredway Development](https://kyle-tredway-portfolio.netlify.app/) — professional Solidity smart contract packages for Web3 companies.

A production-ready React frontend for interacting with a deployed ERC-20 token vesting contract.

> ⚠️ This dashboard is connected to the Sepolia test network for demonstration purposes only.
> These contracts have not been professionally audited. A full security audit is strongly recommended before any mainnet deployment.

This project demonstrates the full lifecycle of a token vesting management dashboard including:

- Wallet connection and network validation
- Real-time vesting schedule data loaded from the blockchain
- Role-based admin controls
- Transaction feedback with Etherscan verification

The repository represents the frontend layer of an ERC-20 Token Vesting package, designed to work alongside the ERC-20 Token Launch Contract and ERC-20 Token Vesting Contract.


## PROJECT GOALS

The purpose of this project is to demonstrate how a modern token vesting dashboard should be designed for real-world use.

The dashboard includes common features required by token vesting interfaces:

- Live vesting schedule data loaded from the blockchain
- Wallet-based role detection
- Protected admin functions
- Beneficiary schedule visibility with real-time progress tracking
- User-friendly transaction status and error handling
- Etherscan transaction verification

These patterns are widely used in production Web3 applications.


## DASHBOARD FEATURES

### WALLET CONNECTION

The dashboard connects to MetaMask and automatically detects the connected wallet's roles.
A network check ensures the user is on the correct chain before connecting.
The UI refreshes automatically when the wallet is switched inside MetaMask.

### LIVE VESTING DATA

On connection, the dashboard loads the following data directly from the contract:

- Total Locked — tokens currently locked across all active vesting schedules
- Withdrawable — tokens in the contract not assigned to any schedule (admin only)
- Active Schedules — number of currently active vesting schedules

### MY VESTING SCHEDULES

Beneficiaries can view all of their vesting schedules including:

- Total Amount — total tokens in the schedule
- Released — tokens already claimed
- Releasable Now — tokens available to claim at this moment
- Status — Active, Vesting Complete, or Revoked
- Start Date, Cliff Date, and End Date
- Claimed Progress bar showing percentage of tokens claimed

### RELEASE TOKENS

Beneficiaries can claim their vested tokens at any time after the cliff period.
The Release Tokens button is disabled when no tokens are available.
After all tokens are claimed the button grays out permanently.
After full vesting the status changes to **Vesting Complete**.

### ROLE-BASED ADMIN PANEL

The admin panel is only visible to wallets holding the ADMIN_ROLE.
Non-admin wallets see only their own vesting schedules.

Admin functions include:

| Function | Description |
|----------|-------------|
| Create Vesting Schedule | Create a new schedule for any beneficiary address |
| Lookup & Revoke | Look up any wallet's schedules and revoke if needed |
| Withdraw Unlocked Tokens | Withdraw unallocated tokens from the contract |

### CREATE VESTING SCHEDULE

Admins can create schedules with the following parameters:

- Beneficiary address
- Token amount
- Start date
- Cliff period in days
- Vesting duration in days

### LOOKUP & REVOKE

Admins can look up any beneficiary wallet address to view their schedules.
Each active schedule shows full details and a Revoke button.
Revoking immediately decrements the Active Schedules counter.
Unvested tokens are returned to the contract upon revocation.
The beneficiary retains the right to claim any tokens vested before revocation.

### WITHDRAW UNLOCKED TOKENS

Admins can withdraw tokens not locked in any active vesting schedule.
A **Max** button auto-fills the exact withdrawable amount from the contract to avoid rounding issues.

### TRANSACTION FEEDBACK

Every action triggers a color-coded status bar with a loading spinner:

| Action | Status Color |
|--------|-------------|
| Creating Schedule | Electric Blue |
| Releasing Tokens | Lime Green |
| Revoking Schedule | Dark Red |
| Withdrawing | Lime Green |
| Success | Bright Green |
| Error | Red |

On success, a clickable Etherscan link appears for immediate transaction verification.

### ERROR HANDLING

User-friendly error messages are displayed for common failure cases:

- Transaction rejected in MetaMask
- Insufficient funds
- Not enough tokens in contract
- Only beneficiary can release
- No tokens available to release
- Schedule already revoked
- General transaction failure


## TECHNOLOGY STACK

This project was built using the following tools:

- React – Frontend framework
- Ethers.js – Contract interaction library
- MetaMask – Wallet provider
- Alchemy – Ethereum RPC provider for reads
- Tailwind CSS – Utility-first styling
- Sepolia Test Network – Deployment environment


## PROJECT STRUCTURE

```
src/
    App.js
    App.css
    index.js
    contracts/
        TokenVesting.json
        sepolia.json

public/
    index.html

.env
```

### APP.JS

Contains all wallet connection logic, contract interaction, and UI rendering.

### CONTRACTS

Contains the ABI and deployed contract address pulled in at runtime.

### ENV

Contains the Alchemy RPC URL used for all read operations.


## INSTALLATION

### CLONE THE REPOSITORY:

```bash
git clone https://github.com/Ktredway0128/erc20-vesting-dashboard
cd erc20-vesting-dashboard
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

- Read vesting data directly from the blockchain via Alchemy
- Bypass MetaMask's RPC for all read operations


## HOW TO USE

### CONNECTING YOUR WALLET

1. Make sure MetaMask is installed in your browser
2. Switch MetaMask to the **Sepolia** test network
3. Click **Connect Wallet**
4. Approve the connection in MetaMask

### VIEWING YOUR VESTING SCHEDULE (Beneficiary)

1. Connect with the wallet that has an active vesting schedule
2. Your schedules will load automatically under **My Vesting Schedules**
3. Hit **↻ Refresh** at any time to see the latest releasable amount

### RELEASING TOKENS (Beneficiary)

1. Connect with your beneficiary wallet
2. Click **Release Tokens** when tokens are available
3. Confirm the transaction in MetaMask
4. Your tokens will appear in your wallet after confirmation

### CREATING A VESTING SCHEDULE (Admin Only)

1. Connect with a wallet that holds the ADMIN_ROLE
2. In the Admin Panel, fill in the beneficiary address, token amount, start date, cliff period, and duration
3. Click **Create Schedule**
4. Confirm the transaction in MetaMask

### REVOKING A SCHEDULE (Admin Only)

1. Connect with a wallet that holds the ADMIN_ROLE
2. In the **Lookup & Revoke** section, enter the beneficiary wallet address
3. Click **Look Up** to load their schedules
4. Click **Revoke** on the schedule you want to cancel
5. Confirm the transaction in MetaMask

### WITHDRAWING TOKENS (Admin Only)

1. Connect with a wallet that holds the ADMIN_ROLE
2. Enter an amount or click **Max** to fill the exact withdrawable amount
3. Click **Withdraw**
4. Confirm the transaction in MetaMask


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
| TokenVesting | `0x81F71D5D73383750C9d4BCe65C493A55BA887ecB` | [View on Etherscan](https://sepolia.etherscan.io/address/0x81F71D5D73383750C9d4BCe65C493A55BA887ecB#code) |

Deployed: 2026-03-26


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
- Beneficiaries can only see and interact with their own schedules

**Contract Level**
- All role checks are enforced by the smart contract
- The UI is a convenience layer — the contract is the source of truth
- No transaction can bypass the contract's access control
- Vested amount is frozen at revocation time on-chain — cannot be manipulated by the UI


## EXAMPLE USE CASES

This dashboard architecture can support many types of projects:

- Employee token compensation plans
- Investor token lockup agreements
- Founder and advisor vesting schedules
- DAO contributor token grants
- Startup equity token systems


## FUTURE ENHANCEMENTS

This dashboard serves as the second frontend layer in a larger Web3 infrastructure package.

Possible upgrades include:

- Airdrop dashboard integration
- Active beneficiary list for admins
- Vesting schedule completion notifications
- Multi-wallet admin management
- Mainnet deployment


## AUTHOR

Kyle Tredway

Smart Contract Developer / Token Launch Specialist


## LICENSE

MIT License