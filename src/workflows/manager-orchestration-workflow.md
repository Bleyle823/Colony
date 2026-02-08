# Manager Orchestration Workflow

**Priority: Execute actions first. Minimize chat. No back-and-forth.**

---

## Execution principles

- **Act first, report after.** Each agent runs its step and reports the outcome. Do not ask for confirmation or clarification before executing.
- **No blocking.** If a step fails, log the error, note the failing step, and proceed to the next. Do not wait for user input or inter-agent discussion.
- **Minimal commentary.** Agents may add brief context only when it does not delay execution. Omit non-essential commentary.
- **Strict order.** Steps run in the sequence below. Do not reorder or skip except when a step is impossible (then log and continue).

---

## Execution order

### 1. Guardian – research and context
- Check DeFi news and market conditions.
- Give brief investment advice based on current market data.
- Keep commentary concise; do not block the workflow.
- **Execute in parallel or immediately; do not wait for other agents.**

### 2. Treasurer – Arc wallet setup
- Check and report the Arc wallet address.
- Confirm the Arc wallet is configured correctly.
- **Execute immediately; no confirmation round-trips.**

### 3. Treasurer – Arc USDC balance
- Check the USDC balance on Arc and report it.
- **Execute as soon as step 2 is done.**

### 4. Treasurer – Arc → Ethereum
- Send exactly **1 USDC** from Arc (crosschain) to Ethereum mainnet.
- **Execute the transfer.** Do not pause for approval.

### 5. Treasurer – Uniswap swap
- On Ethereum mainnet, swap USDC → APPLON (Apple Ondo Tokenized Stock) using Uniswap.
- Use available USDC (or the amount that makes sense after fees).
- **Execute the swap.** Do not pause for approval.

### 6. Treasurer – Arc BridgeKit → Solana
- Send exactly **1 USDC** via ARC BridgeKit to: `A3e6JFcDBQWtDegmjKWqwRZcP7WMKDHj7imZtK1MFE1D`.
- **Execute the bridge transaction.** Do not pause for approval.

### 7. Strategist – Solana TSLAx balance
- Check the TSLAx balance on Solana mainnet for the configured wallet.
- Report the balance.
- **Execute immediately when assigned.**

### 8. Strategist – Kamino borrow
- Use **0.003 TSLAx** as collateral to borrow USDC on Kamino.
- **Execute the borrow transaction.** Do not pause for approval.

### 9. Manager – final summary
- Compile results from Guardian, Treasurer, and Strategist.
- Report success/failure for each step and any errors.
- Provide a short, user-facing summary of the run.

---

## Rules

| Rule | Description |
|------|-------------|
| **Order** | Execute steps in this exact order. |
| **On failure** | Log the error, note the failing step, continue to the next. |
| **Amounts** | 1 USDC (Arc→Ethereum), 1 USDC (Arc→Solana), 0.003 TSLAx (Kamino collateral). |
| **Routing** | Manager assigns work to Guardian, Treasurer, Strategist. No chat handoffs—assign and run. |
| **Roles** | Guardian: news/market. Treasurer: Arc + Uniswap. Strategist: TSLAx + Kamino. |
| **Execution** | Execute each transaction where technically possible; do not skip unless impossible. |
| **Summary** | Manager delivers the final summary to the user. |

---

## Manager instructions

**Begin orchestration.** Assign steps to Guardian, Treasurer, and Strategist in order. Do not ask agents to “confirm” or “proceed”—instruct them to execute. Collect results and errors, then produce the final summary. Prioritize speed and execution over discussion.
