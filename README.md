# Colony — Autonomous RWA-Backed Yield Optimizer Swarm

A **multi-agent DeFi swarm** built on **ElizaOS** that manages **USDC-denominated portfolios** across **Solana** and **Ethereum**. Specialized agents handle bridging, RWA acquisition, lending, and risk monitoring to optimize yields through **Real-World Assets (RWAs)** with minimal back-and-forth and execution-first workflows.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Agents & Roles](#agents--roles)
- [Plugins & Capabilities](#plugins--capabilities)
- [User Workflows](#user-workflows)
- [Orchestration](#orchestration)
- [Getting Started](#getting-started)
- [Environment & Configuration](#environment--configuration)
- [Project Structure](#project-structure)
- [Scripts & Testing](#scripts--testing)
- [Technical Requirements](#technical-requirements)

---

## Overview

| Aspect | Description |
|--------|-------------|
| **Framework** | ElizaOS (multi-character swarm) |
| **Package manager** | `bun` (required) |
| **Chains** | Ethereum, Solana, Arc Network, Base, Arbitrum, Optimism, Polygon |
| **Core assets** | USDC, tokenized RWAs (TSLAx, APPLON, mF-ONE, GLDx, etc.) |
| **Protocols** | Arc (cross-chain), Uniswap (swaps), Kamino (lending), DeFi News (monitoring) |

The swarm divides work across four agents: **Manager** (user coordination), **Treasurer** (bridging & RWA acquisition), **Strategist** (Kamino lending & leverage), and **Guardian** (risk & news). Workflows are designed to **execute actions first** and minimize chat round-trips.

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────────────────┐
│    User     │────▶│  Manager (Portfolio Manager)                              │
└─────────────┘     │  • Single point of contact • Aggregates reports • Routing  │
                    └───────────────────────────┬────────────────────────────────┘
                                               │
         ┌─────────────────────────────────────┼─────────────────────────────────────┐
         │                                     │                                     │
         ▼                                     ▼                                     ▼
┌─────────────────┐                 ┌─────────────────┐                 ┌─────────────────┐
│    Treasurer     │                 │   Strategist    │                 │    Guardian     │
│ Arc, Uniswap,   │◀─── RWA/USDC ───▶│ Kamino, Solana  │                 │  DeFi News      │
│ ENS, Solana      │                 │ Lending & yield │                 │  Risk & alerts  │
└────────┬────────┘                 └────────┬────────┘                 └────────┬────────┘
         │                                    │                                    │
         ▼                                    ▼                                    ▼
   Ethereum, Arc,                       Solana (Kamino)                    News feeds,
   Uniswap (RWAs)                      TSLAx collateral                   Health factors
```

- **Communication**: Shared database state and swarm coordination (task delegation, status, workflows).
- **Execution**: Manager assigns steps in order; agents run without waiting for confirmation. Failures are logged and the next step runs.

---

## Agents & Roles

### 1. Manager (Portfolio Manager)

- **Role**: User-facing coordinator and single point of contact.
- **Plugins**: `plugin-sql`, `plugin-bootstrap`, `starterPlugin`, `openRouterPlugin`.
- **Responsibilities**:
  - Handle user requests (deposits, withdrawals, status).
  - Aggregate reports from Treasurer, Strategist, and Guardian.
  - Route commands to the right agent.
  - Provide portfolio summaries and orchestration (see [Orchestration](#orchestration)).

### 2. Treasurer

- **Role**: Cross-chain liquidity, RWA acquisition, and custody.
- **Plugins**: `plugin-arc`, `plugin-ens`, `plugin-uniswap`, `plugin-solana`, plus core/bootstrap/SQL/OpenRouter.
- **Responsibilities**:
  - **Arc**: Wallet address, USDC balance, cross-chain transfer, BridgeKit (e.g. Arc → Ethereum, Arc → Solana).
  - **ENS**: Resolve `.eth` addresses for payments.
  - **Uniswap**: Swap USDC for RWAs (e.g. APPLON, mF-ONE, GLDx) on Ethereum.
  - **Solana**: Operations that support cross-chain flows.
  - Coordinate with Strategist: send RWA tokens for collateral; receive borrowed USDC for reinvestment.
  - Settlement: unwind RWA positions and bridge USDC back on withdrawal.

### 3. Strategist

- **Role**: Yield and leverage via Kamino on Solana.
- **Plugins**: `plugin-solana`, `plugin-kamino`, plus core/bootstrap/SQL/OpenRouter.
- **Responsibilities**:
  - Receive RWA tokens (e.g. TSLAx) from Treasurer.
  - **Kamino**: Deposit RWA as collateral, borrow USDC, run yield loops, rebalance.
  - Check RWA balances (e.g. TSLAx) before acting.
  - Manage leverage, health factor, and LTV; respond to Guardian alerts with rebalancing.

### 4. Guardian

- **Role**: Risk and market intelligence.
- **Plugins**: `plugin-defi-news`, plus core/bootstrap/SQL/OpenRouter.
- **Responsibilities**:
  - Monitor DeFi news and market conditions.
  - Track RWA protocols, rates, and regulatory news.
  - Assess health factors and liquidation risk.
  - Send alerts to Strategist when thresholds are breached; support emergency responses.

---

## Plugins & Capabilities

| Plugin | Agent(s) | Purpose |
|--------|----------|---------|
| **plugin-arc** | Treasurer | Arc wallet (getAddress, getBalance), cross-chain transfer, bridge (e.g. to Ethereum/Solana). |
| **plugin-ens** | Treasurer | Resolve ENS names (e.g. `user.eth`) for payments. |
| **plugin-uniswap** | Treasurer | Swap USDC ↔ RWAs on Ethereum (quote, swap, enhanced swap). |
| **plugin-solana** | Treasurer, Strategist | Solana RPC and wallet operations. |
| **plugin-kamino** | Strategist | Balance checks, deposit/borrow, yield loop, rebalance; TSLAx and other RWA collateral. |
| **plugin-defi-news** | Guardian | DeFi news and market context. |
| **plugin-morpho** | (available) | Morpho lending (Ethereum); not wired in default swarm (Strategist uses Kamino). |
| **plugin-swarm** | (available) | Task delegation, status, workflow coordination. |
| **plugin-circle** | (available) | Programmable Wallets, CCTP; can be used alongside or instead of Arc. |

---

## User Workflows

### Deposit & yield loop

1. User tells **Manager**: e.g. “Start deposit”.
2. **Manager** → **Treasurer**: Generate deposit address (Arc/MPC).
3. **Treasurer**: Detect USDC, bridge to target chain (e.g. Arc → Ethereum/Solana).
4. **Treasurer**: Swap USDC for RWAs on Uniswap (Ethereum) or equivalent.
5. **Treasurer** → **Strategist**: Send RWA tokens.
6. **Strategist**: Deposit RWA as collateral on Kamino, borrow USDC.
7. **Strategist** → **Treasurer**: Send borrowed USDC.
8. **Treasurer**: Reinvest USDC into more RWAs (repeat as desired).
9. **Guardian**: Ongoing news and risk monitoring; alerts Strategist if needed.

### Withdrawal

1. User tells **Manager**: “Withdraw”.
2. **Manager** coordinates **Strategist**: Repay Kamino loans, release RWA collateral.
3. **Strategist** → **Treasurer**: Return RWA tokens.
4. **Treasurer**: Swap RWAs → USDC on Uniswap, bridge USDC to user (e.g. via Arc/CCTP).

### Risk response

1. **Guardian** detects breach (e.g. health factor &lt; 1.2) or critical news.
2. **Guardian** alerts **Strategist** (and optionally Manager).
3. **Strategist** rebalances (reduce leverage, add collateral, or repay) per workflow.

---

## Orchestration

The Manager can run a **structured execution workflow** so agents act in order with minimal chat:

- **Principles**: Act first, report after; no blocking on failure (log and continue); minimal commentary; strict step order.
- **Steps** (high level): Guardian (news/context) → Treasurer (Arc wallet, balance, Arc→Ethereum, Uniswap swap, Arc→Solana) → Strategist (Solana TSLAx balance, Kamino borrow) → Manager (final summary).
- **Details**: See `src/workflows/manager-orchestration-workflow.md`.

Manager instructs agents to **execute** (no “confirm” or “proceed” round-trips); results and errors are collected into a single user-facing summary.

---

## Getting Started

### Prerequisites

- **Bun** ([bun.sh](https://bun.sh))
- **Node.js** (for ElizaOS)
- **Environment**: Windows (as in your setup); Linux/macOS also supported

### Install and run

```bash
# Clone (if applicable) and enter project
cd Colony

# Install dependencies
bun install

# Copy environment template and add your keys
cp .env.example .env
# Edit .env: at least one model provider (e.g. OPENAI_API_KEY or OPENROUTER), and any chain/API keys you need

# Development (hot reload)
bun run dev
# or
elizaos dev

# Production
bun run build
elizaos start
```

### First steps

1. Set **model provider**: e.g. `OPENAI_API_KEY` or `OPENROUTER_API_KEY` in `.env` (embedding provider may be required separately; see `.env.example`).
2. Set **chain/plugin keys** as needed: Arc, EVM, Solana, Uniswap, Kamino, DeFi News, etc. (see [Environment & Configuration](#environment--configuration)).
3. Talk to the **Manager** (e.g. via web UI or configured channel); request deposit, status, or run the orchestration workflow.

---

## Environment & Configuration

Use `.env` (from `.env.example`). Key groups:

| Purpose | Variables (examples) |
|--------|----------------------|
| **Models** | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`; override URLs if needed. |
| **Database** | `POSTGRES_URL` or default PGLite. |
| **EVM** | `EVM_PRIVATE_KEY`, `EVM_PROVIDER_URL`, `EVM_CHAINS`. |
| **Solana** | `SOLANA_PUBLIC_KEY`, `SOLANA_PRIVATE_KEY`; RPC via plugin config. |
| **APIs** | `BIRDEYE_API_KEY`, `JUPITER_API_KEY`, `HELIUS_API_KEY`, `COINMARKETCAP_API_KEY`, etc. |
| **Logging** | `LOG_LEVEL` (e.g. `info`, `debug`). |

Plugin-specific keys (Arc, Uniswap, Kamino, etc.) are documented in each plugin’s README or `environment.ts`. Keep secrets in `.env` or agent secrets; do not commit `.env`.

---

## Project Structure

```
Colony/
├── src/
│   ├── index.ts              # Swarm definition: Manager, Treasurer, Strategist, Guardian
│   ├── character.ts          # Base character (if used)
│   ├── plugin.ts             # Starter/custom plugin
│   ├── characters/           # Agent definitions
│   │   ├── manager.ts
│   │   ├── treasurer.ts
│   │   ├── strategist.ts
│   │   └── guardian.ts
│   ├── services/
│   │   └── swarmCoordinator.ts
│   └── workflows/
│       ├── depositWorkflow.ts
│       ├── withdrawalWorkflow.ts
│       ├── riskManagement.ts
│       └── manager-orchestration-workflow.md   # Orchestration blueprint
├── plugin-arc/               # Arc wallet, balance, transfer, bridge
├── plugin-ens/               # ENS resolution
├── plugin-uniswap/           # Uniswap swap/quote on Ethereum
├── plugin-kamino/            # Kamino deposit, borrow, loop, rebalance, balance checks
├── plugin-morpho/            # Morpho lending (optional)
├── plugin-solana/            # Solana RPC & wallet
├── plugin-swarm/             # Delegation, status, workflow coordination
├── plugin-defi-news-1.x/     # DeFi news (Guardian)
├── plugin-circle/            # Circle MPC / CCTP (optional)
├── .env.example
├── package.json
└── README.md
```

---

## Scripts & Testing

| Command | Description |
|--------|-------------|
| `bun run dev` | Start in development mode (hot reload). |
| `bun run build` | Build (e.g. `bun run build.ts`). |
| `bun run start` | Start production server (`elizaos start`). |
| `bun run type-check` | TypeScript check (`tsc --noEmit`). |
| `bun run format` | Format with Prettier. |
| `bun run test` | Install test deps + component + e2e tests. |
| `bun run test:unit` | Unit tests (Vitest). |
| `bun run test:swarm` | Swarm-related tests. |
| `bun run test:workflows` | Workflow tests. |
| `bun run test:plugins` | Plugin tests. |
| `bun run check-all` | type-check + format check + test. |

---

## Technical Requirements

- **OS**: Windows (primary in your env); Linux/macOS supported.
- **Runtime**: Node.js + Bun (ElizaOS).
- **Chains**: Solana (mainnet/devnet), Ethereum (and L2s via Arc/CCTP/Uniswap).
- **Integrations**:
  - **Arc**: Cross-chain USDC, BridgeKit (e.g. to Ethereum, Solana).
  - **Uniswap**: RWA swaps on Ethereum.
  - **Kamino**: Lending and yield loops on Solana (e.g. TSLAx collateral).
  - **ENS**: Address resolution.
  - **DeFi News**: Risk and market context for Guardian.

For more detail on ElizaOS and character/plugin patterns, see the project’s `CLAUDE.md` (if present) and each plugin’s README.
