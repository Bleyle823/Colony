# Plugin testing guide

Use these after starting the agent with `bun run dev` (or `elizaos dev`). Send the prompts in the chat UI or API; the agent will route them to the right plugin.

---

## 1. Arc plugin

**Requires:** `ARC_PRIVATE_KEY` in `.env`. Optional: `ETHEREUM_PROVIDER_URL` for ENS resolution.

| What to test | Example prompt |
|--------------|----------------|
| Balance (your wallet) | `Check my Arc balance` |
| Balance (by address) | `What's the Arc balance for 0x1234567890123456789012345678901234567890` |
| Balance (by ENS) | `Check Arc balance for vitalik.eth` |
| Send to address | `Send 0.1 USDC to 0x1234567890123456789012345678901234567890` |
| Send to ENS | `Send 0.1 USDC to vitalik.eth` |

---

## 2. Circle plugin

**Requires:** `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`; for BridgeKit: `EVM_PRIVATE_KEY`, `SOLANA_PRIVATE_KEY`.

| What to test | Example prompt |
|--------------|----------------|
| Send USDC (Developer-Controlled Wallets) | `Send 1 USDC to 0x1234567890123456789012345678901234567890` (context may specify chain) |
| Cross-chain / bridge | Ask to bridge USDC from one chain to another (e.g. Ethereum Sepolia → Solana Devnet) |

**Scripts (no agent):**

```bash
# Test Circle API + wallet set + testnet funding
bun run scripts/test-circle-setup.ts

# Test BridgeKit adapters (EVM + Solana)
bun run scripts/test-bridge-setup.ts
```

---

## 3. ENS plugin

**Requires:** `ETHEREUM_PROVIDER_URL` or `EVM_PROVIDER_URL` in `.env`. Manage actions need `EVM_PRIVATE_KEY`.

| What to test | Example prompt |
|--------------|----------------|
| Resolve name → address | `What is the address for vitalik.eth?` or `Resolve vitalik.eth` |
| Reverse resolve (address → name) | `What ENS name does 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 have?` |
| ENS avatar | `Get the avatar for vitalik.eth` |
| ENS text record | `What is the email (or url/twitter) for vitalik.eth?` |

---

## Run the agent

```bash
# From repo root
bun run dev
```

Then open the UI (e.g. http://localhost:3000 or the URL shown) and send the prompts above.

---

## Run plugin unit tests

```bash
# All tests
bun test

# Filter by plugin
bun test ens-plugin
bun test circle-plugin
```
