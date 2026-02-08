# Kamino Plugin for ElizaOS

A comprehensive plugin for interacting with Kamino Finance on Solana, with full support for Tesla xStock (TSLAx) and other Real-World Assets (RWAs) as collateral.

## Features

### ✅ Tesla xStock (TSLAx) Support
- **Mint Address**: `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB`
- Full support for using Tesla xStock as collateral
- Balance checking before transactions
- Automatic mint resolution and validation

### 🏦 Lending Operations
- **Deposit Assets**: Deposit USDC, SOL, or RWA tokens as collateral
- **Borrow USDC**: Borrow USDC against deposited collateral
- **Balance Checking**: Check token balances before operations
- **Error Handling**: Comprehensive validation and error messages

### 🔄 Advanced Features
- **Jupiter Swaps**: Acquire RWA tokens via Jupiter Aggregator
- **Yield Loops**: Execute leveraged yield loops (borrow → buy → deposit)
- **Portfolio Rebalancing**: Analyze and rebalance LTV ratios

## Available Actions

| Action | Description | Example Usage |
|--------|-------------|---------------|
| `CHECK_TOKEN_BALANCE` | Check token balances | "Check my TSLAx balance" |
| `DEPOSIT_ON_KAMINO` | Deposit assets as collateral | "Deposit 50 TSLAx" |
| `BORROW_USDC_ON_KAMINO` | Borrow USDC against collateral | "Borrow 100 USDC" |
| `BUY_RWA` | Swap USDC for RWA tokens | "Buy 200 USDC worth of TSLAx" |
| `EXECUTE_YIELD_LOOP` | Execute leveraged loops | "Execute 3 loops with TSLAx" |
| `REBALANCE_PORTFOLIO` | Rebalance portfolio | "Rebalance my Kamino portfolio" |

## Supported RWA Tokens

| Symbol | Name | Mint Address |
|--------|------|--------------|
| TSLAx | Tesla xStock | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` |
| CRCLx | Circle xStock | `XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1` |
| GOOGLx | Google xStock | `XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN` |
| GLDx | Gold xStock | `Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re` |
| AMZNx | Amazon xStock | `Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg` |
| NVDAx | NVIDIA xStock | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` |
| METAx | Meta xStock | `Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu` |
| AAPLx | Apple xStock | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` |

## Configuration

### Environment Variables

```bash
# Required
SOLANA_PRIVATE_KEY=your-solana-private-key
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Optional
KAMINO_RWA_MINT=default-rwa-mint-address
```

### Character Integration

Add to your character's plugins array:

```typescript
import { kaminoPlugin } from '../plugin-kamino/src/index.js';

export const character: Character = {
  plugins: [
    '@elizaos/plugin-sql',
    '@elizaos/plugin-solana',
    kaminoPlugin,
    // ... other plugins
  ],
};
```

## Usage Examples

### Tesla xStock Operations

```typescript
// Check Tesla xStock balance
"Check my TSLAx balance"

// Acquire Tesla xStock
"Buy 500 USDC worth of TSLAx"

// Deposit as collateral
"Deposit 100 TSLAx as collateral"

// Borrow against collateral
"Borrow 200 USDC"

// Execute leveraged loop
"Execute 3 yield loops with TSLAx starting with 1000 USDC"
```

### Complete Flow Example

1. **Check Balance**: "What's my USDC balance?"
2. **Acquire Tesla xStock**: "Buy 1000 USDC worth of TSLAx"
3. **Check Tesla Balance**: "Check my TSLAx balance"
4. **Deposit Collateral**: "Deposit 50 TSLAx as collateral"
5. **Borrow USDC**: "Borrow 100 USDC against my collateral"
6. **Leverage Up**: "Execute 2 more loops with the borrowed USDC"

## Technical Implementation

### Transaction Execution
- Uses Kamino SDK's `KaminoAction.buildDepositTxns` and `buildBorrowTxns`
- Fetches user's actual obligation accounts via `market.getAllUserObligations`
- Executes transactions using `sendTransactionFromAction`
- Returns actual transaction signatures

### Balance Validation
- Checks token balances before deposit operations
- Validates sufficient collateral before borrow operations
- Provides clear error messages for insufficient funds

### Error Handling
- Network connectivity validation
- Transaction failure recovery
- Slippage and timeout handling
- Comprehensive user feedback

## Security Features

- ✅ Balance validation before transactions
- ✅ Minimum amount validation
- ✅ Transaction confirmation waiting
- ✅ Comprehensive error handling
- ✅ Real obligation account fetching
- ✅ Proper decimal handling for all tokens

## Integration Status

- ✅ **Core Functionality**: Complete transaction execution
- ✅ **Tesla xStock Support**: Full integration with correct mint
- ✅ **Balance Checking**: Pre-transaction validation
- ✅ **Error Handling**: Comprehensive validation and feedback
- ✅ **Character Integration**: Integrated with Treasurer character
- ✅ **Action Discovery**: Natural language processing support

## Ready for Production

The Kamino plugin is now fully functional and ready for production use with Tesla xStock as collateral. All critical components have been implemented and tested:

1. **Transaction Execution**: Real transactions with actual signatures
2. **Tesla xStock Integration**: Proper mint resolution and handling
3. **Balance Validation**: Pre-transaction balance checking
4. **Error Handling**: Comprehensive validation and user feedback
5. **Agent Integration**: Full integration with Treasurer character

The plugin can now safely handle Tesla xStock operations on Solana mainnet with proper validation and error handling.