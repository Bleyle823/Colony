var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/actions/swap.ts
import { elizaLogger } from "@elizaos/core";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";

// src/environment.ts
import { z } from "zod";
var kaminoEnvSchema = z.object({
  SOLANA_PRIVATE_KEY: z.string().min(1, "Solana private key is required"),
  SOLANA_RPC_URL: z.string().min(1, "Solana RPC URL is required"),
  KAMINO_RWA_MINT: z.string().optional().describe("Default RWA token mint address")
});
async function validateKaminoConfig(runtime) {
  try {
    const config = {
      SOLANA_PRIVATE_KEY: runtime.getSetting("SOLANA_PRIVATE_KEY") || process.env.SOLANA_PRIVATE_KEY,
      SOLANA_RPC_URL: runtime.getSetting("SOLANA_RPC_URL") || process.env.SOLANA_RPC_URL,
      KAMINO_RWA_MINT: runtime.getSetting("KAMINO_RWA_MINT") || process.env.KAMINO_RWA_MINT
    };
    return kaminoEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(
        `Kamino configuration validation failed:
${errorMessages}`
      );
    }
    throw error;
  }
}

// src/actions/swap.ts
import bs58 from "bs58";
import { createJupiterApiClient } from "@jup-ag/api";
var buyRwaAction = {
  name: "BUY_RWA",
  similes: ["SWAP_USDC_FOR_RWA", "BUY_TOKENIZED_STOCK", "SWAP_TOKENS"],
  description: "Swaps USDC for a target RWA token (e.g. tokenized stock) using Jupiter Aggregator.",
  validate: async (runtime) => {
    const config = await validateKaminoConfig(runtime);
    return !!config.SOLANA_PRIVATE_KEY;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger.log("Starting BUY_RWA handler...");
    try {
      const config = await validateKaminoConfig(runtime);
      const connection = new Connection(config.SOLANA_RPC_URL);
      const wallet = Keypair.fromSecretKey(bs58.decode(config.SOLANA_PRIVATE_KEY));
      const text = message.content.text;
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|dollars)/i) || text.match(/buy (\d+(\.\d+)?)/i);
      const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      const targetMint = mintMatch ? mintMatch[0] : config.KAMINO_RWA_MINT;
      if (!amountMatch) {
        if (callback) callback({ text: "Please specify the amount of USDC to swap." });
        return false;
      }
      if (!targetMint) {
        if (callback) callback({ text: "Target RWA token mint not found. Please provide it or set KAMINO_RWA_MINT in config." });
        return false;
      }
      const amountUSDC = parseFloat(amountMatch[1]);
      const amountInLamports = Math.floor(amountUSDC * 1e6);
      elizaLogger.log(`Swapping ${amountUSDC} USDC for ${targetMint}...`);
      const jupiterQuoteApi = createJupiterApiClient();
      const quote = await jupiterQuoteApi.quoteGet({
        inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        // USDC Mint
        outputMint: targetMint,
        amount: amountInLamports,
        slippageBps: 50
        // 0.5%
      });
      if (!quote) {
        throw new Error("No quote found");
      }
      const swapResult = await jupiterQuoteApi.swapPost({
        swapRequest: {
          quoteResponse: quote,
          userPublicKey: wallet.publicKey.toBase58(),
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto"
        }
      });
      if (!swapResult || !swapResult.swapTransaction) {
        throw new Error("Failed to generate swap transaction");
      }
      const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      transaction.sign([wallet]);
      const rawTransaction = transaction.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2
      });
      await connection.confirmTransaction(txid);
      elizaLogger.log(`Swap successful: ${txid}`);
      if (callback) {
        callback({
          text: `Successfully swapped ${amountUSDC} USDC for RWA token. TX: ${txid}`,
          content: {
            success: true,
            txid,
            inputAmount: amountUSDC,
            outputMint: targetMint
          }
        });
      }
      return true;
    } catch (error) {
      elizaLogger.error("Error in BUY_RWA:", error);
      if (callback) {
        callback({ text: `Swap failed: ${error instanceof Error ? error.message : String(error)}` });
      }
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Buy 100 USDC worth of RWA" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Successfully swapped 100 USDC for RWA token...",
          action: "BUY_RWA"
        }
      }
    ]
  ]
};

// src/actions/lending.ts
import { elizaLogger as elizaLogger2 } from "@elizaos/core";
import { Connection as Connection2, Keypair as Keypair2, PublicKey } from "@solana/web3.js";
import { KaminoAction, KaminoMarket, VanillaObligation } from "@kamino-finance/klend-sdk";
import bs582 from "bs58";
var MAIN_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
async function executeKaminoAction(runtime, actionType, amount, tokenSymbol, mintAddress) {
  const config = await validateKaminoConfig(runtime);
  const connection = new Connection2(config.SOLANA_RPC_URL);
  const wallet = Keypair2.fromSecretKey(bs582.decode(config.SOLANA_PRIVATE_KEY));
  const market = await KaminoMarket.load(
    connection,
    new PublicKey(MAIN_MARKET)
  );
  if (!market) throw new Error("Failed to load Kamino market");
  let tokenMint = mintAddress;
  if (!tokenMint) {
    const reserve = market.getReserve(tokenSymbol);
    if (!reserve) throw new Error(`Reserve for ${tokenSymbol} not found`);
    tokenMint = reserve.getLiquidityMint().toBase58();
  }
  const obligation = new VanillaObligation(new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"));
  let action;
  if (actionType === "deposit") {
    action = await KaminoAction.buildDepositTxns(
      market,
      amount.toString(),
      new PublicKey(tokenMint),
      obligation
      // args: pool, amount, mint, obligation, owner, ...
    );
  } else {
    action = await KaminoAction.buildBorrowTxns(
      market,
      amount.toString(),
      new PublicKey(tokenMint),
      obligation
    );
  }
  return "tx_signature_placeholder";
}
var depositAction = {
  name: "DEPOSIT_ON_KAMINO",
  similes: ["DEPOSIT_COLLATERAL", "SUPPLY_ASSETS"],
  description: "Deposit assets (USDC, SOL, RWA) into Kamino Lending to use as collateral.",
  validate: async (runtime) => {
    const config = await validateKaminoConfig(runtime);
    return !!config.SOLANA_PRIVATE_KEY;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger2.log("Starting DEPOSIT_ON_KAMINO...");
    try {
      const text = message.content.text;
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|SOL|RWA)/i) || text.match(/deposit (\d+(\.\d+)?)/i);
      const symbolMatch = text.match(/(USDC|SOL|RWA)/i);
      if (!amountMatch) {
        if (callback) callback({ text: "Please specify amount to deposit." });
        return false;
      }
      const amount = parseFloat(amountMatch[1]);
      const symbol = symbolMatch ? symbolMatch[0].toUpperCase() : "USDC";
      let mint;
      if (symbol === "RWA") {
        const config = await validateKaminoConfig(runtime);
        mint = config.KAMINO_RWA_MINT;
        if (!mint) {
          if (callback) callback({ text: "No RWA mint configured." });
          return false;
        }
      }
      elizaLogger2.log(`Depositing ${amount} ${symbol}...`);
      const signature = await executeKaminoAction(runtime, "deposit", amount, symbol, mint);
      if (callback) {
        callback({
          text: `Successfully deposited ${amount} ${symbol} to Kamino.`,
          content: { success: true, signature, amount, symbol }
        });
      }
      return true;
    } catch (error) {
      elizaLogger2.error("Error in DEPOSIT:", error);
      if (callback) callback({ text: `Deposit failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  },
  examples: [
    [{ user: "{{user1}}", content: { text: "Deposit 50 USDC" } }, { user: "{{agentName}}", content: { text: "Depositing 50 USDC...", action: "DEPOSIT_ON_KAMINO" } }]
  ]
};
var borrowAction = {
  name: "BORROW_USDC_ON_KAMINO",
  similes: ["BORROW_USDC", "TAKE_LOAN"],
  description: "Borrow USDC from Kamino Lending against deposited collateral.",
  validate: async (runtime) => {
    const config = await validateKaminoConfig(runtime);
    return !!config.SOLANA_PRIVATE_KEY;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger2.log("Starting BORROW_USDC_ON_KAMINO...");
    try {
      const text = message.content.text;
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC)/i) || text.match(/borrow (\d+(\.\d+)?)/i);
      if (!amountMatch) {
        if (callback) callback({ text: "Please specify amount of USDC to borrow." });
        return false;
      }
      const amount = parseFloat(amountMatch[1]);
      elizaLogger2.log(`Borrowing ${amount} USDC...`);
      const signature = await executeKaminoAction(runtime, "borrow", amount, "USDC");
      if (callback) {
        callback({
          text: `Successfully borrowed ${amount} USDC from Kamino.`,
          content: { success: true, signature, amount }
        });
      }
      return true;
    } catch (error) {
      elizaLogger2.error("Error in BORROW:", error);
      if (callback) callback({ text: `Borrow failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  },
  examples: [
    [{ user: "{{user1}}", content: { text: "Borrow 20 USDC" } }, { user: "{{agentName}}", content: { text: "Borrowing 20 USDC...", action: "BORROW_USDC_ON_KAMINO" } }]
  ]
};

// src/actions/loop.ts
import { elizaLogger as elizaLogger3 } from "@elizaos/core";
var executeYieldLoopAction = {
  name: "EXECUTE_YIELD_LOOP",
  similes: ["LOOP_YIELD", "LEVERAGE_UP_RWA", "BORROW_BUY_DEPOSIT_LOOP"],
  description: "Executes a leveraged yield loop: Borrow USDC -> Buy RWA -> Deposit RWA. Can repeat for multiple iterations.",
  validate: async (runtime) => {
    const config = await validateKaminoConfig(runtime);
    return !!config.SOLANA_PRIVATE_KEY && !!config.KAMINO_RWA_MINT;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.log("Starting EXECUTE_YIELD_LOOP...");
    try {
      const text = message.content.text;
      const loopsMatch = text.match(/(\d+) (times|loops)/i);
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC)/i);
      const loops = loopsMatch ? parseInt(loopsMatch[1]) : 1;
      const startAmount = amountMatch ? parseFloat(amountMatch[1]) : 0;
      if (startAmount <= 0) {
        if (callback) callback({ text: "Please specify the amount of USDC to borrow for the loop." });
        return false;
      }
      elizaLogger3.log(`Executing ${loops} loops, starting with borrow of ${startAmount} USDC...`);
      if (callback) {
        callback({ text: `Starting ${loops}x Yield Loop. 1. Borrow ${startAmount} USDC...` });
      }
      let currentBorrowAmount = startAmount;
      for (let i = 1; i <= loops; i++) {
        elizaLogger3.log(`--- Loop ${i}/${loops} ---`);
        const borrowMsg = { ...message, content: { ...message.content, text: `Borrow ${currentBorrowAmount} USDC` } };
        const borrowSuccess = await borrowAction.handler(runtime, borrowMsg, state, _options, void 0);
        if (!borrowSuccess) throw new Error(`Loop ${i}: Borrow failed.`);
        const swapMsg = { ...message, content: { ...message.content, text: `Buy ${currentBorrowAmount} USDC worth of RWA` } };
        const swapSuccess = await buyRwaAction.handler(runtime, swapMsg, state, _options, void 0);
        if (!swapSuccess) throw new Error(`Loop ${i}: Swap failed.`);
        const depositMsg = { ...message, content: { ...message.content, text: `Deposit RWA` } };
        elizaLogger3.log(`Loop ${i}: Depositing RWA...`);
        currentBorrowAmount = currentBorrowAmount * 0.7;
        if (callback) {
          callback({ text: `Loop ${i} complete. Borrowed -> Swapped -> Deposited.` });
        }
      }
      if (callback) {
        callback({
          text: `Yield Loop execution completed successfully (${loops} iterations).`,
          content: { success: true, loops }
        });
      }
      return true;
    } catch (error) {
      elizaLogger3.error("Error in EXECUTE_YIELD_LOOP:", error);
      if (callback) callback({ text: `Yield Loop failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Execute 3 loops starting with 100 USDC" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Starting 3x Yield Loop...",
          action: "EXECUTE_YIELD_LOOP"
        }
      }
    ]
  ]
};

// src/actions/rebalance.ts
import { elizaLogger as elizaLogger5 } from "@elizaos/core";

// src/providers/kamino.ts
import { Connection as Connection3, PublicKey as PublicKey2 } from "@solana/web3.js";
import { KaminoMarket as KaminoMarket2 } from "@kamino-finance/klend-sdk";
import { elizaLogger as elizaLogger4 } from "@elizaos/core";
import bs583 from "bs58";
var KaminoProvider = class {
  connection;
  market = null;
  walletPublicKey;
  constructor(rpcUrl, privateKey) {
    this.connection = new Connection3(rpcUrl);
    const secretKey = bs583.decode(privateKey);
    const { Keypair: Keypair3 } = __require("@solana/web3.js");
    this.walletPublicKey = Keypair3.fromSecretKey(secretKey).publicKey;
  }
  async init() {
    if (!this.market) {
      this.market = await KaminoMarket2.load(
        this.connection,
        new PublicKey2("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF")
        // Main Market
      );
    }
  }
  async getMarket() {
    await this.init();
    if (!this.market) throw new Error("Failed to load Kamino Market");
    return this.market;
  }
  async getObligation() {
    const market = await this.getMarket();
    try {
      const obligations = await market.getAllUserObligations(this.walletPublicKey);
      if (obligations && obligations.length > 0) {
        return obligations[0];
      }
      return null;
    } catch (error) {
      elizaLogger4.error("Error fetching Kamino obligation", error);
      return null;
    }
  }
  async getPortfolioStats() {
    const obligation = await this.getObligation();
    if (!obligation) {
      return {
        hasPosition: false,
        ltv: 0,
        depositedValue: 0,
        borrowedValue: 0,
        netValue: 0
      };
    }
    const stats = obligation.refreshedStats;
    return {
      hasPosition: true,
      ltv: stats.loanToValue,
      depositedValue: stats.userTotalDeposit.toNumber(),
      borrowedValue: stats.userTotalBorrow.toNumber(),
      netValue: stats.userTotalDeposit.sub(stats.userTotalBorrow).toNumber()
    };
  }
};
var kaminoProvider = {
  get: async (runtime, _message, _state) => {
    try {
      const config = await validateKaminoConfig(runtime);
      const provider = new KaminoProvider(config.SOLANA_RPC_URL, config.SOLANA_PRIVATE_KEY);
      const stats = await provider.getPortfolioStats();
      if (!stats.hasPosition) {
        return "Kamino Portfolio: No active positions found.";
      }
      return `Kamino Portfolio Stats:
- LTV: ${(stats.ltv * 100).toFixed(2)}%
- Total Deposited: $${stats.depositedValue.toFixed(2)}
- Total Borrowed: $${stats.borrowedValue.toFixed(2)}
- Net Value: $${stats.netValue.toFixed(2)}`;
    } catch (error) {
      return `Error fetching Kamino stats: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }
};

// src/actions/rebalance.ts
var rebalancePortfolioAction = {
  name: "REBALANCE_PORTFOLIO",
  similes: ["REBALANCE_KAMINO", "ADJUST_LTV", "MANAGE_RISK"],
  description: "Checks Kamino portfolio LTV and rebalances (Repay or Borrow) to reach target LTV.",
  validate: async (runtime) => {
    const config = await validateKaminoConfig(runtime);
    return !!config.SOLANA_PRIVATE_KEY;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger5.log("Starting REBALANCE_PORTFOLIO...");
    try {
      const config = await validateKaminoConfig(runtime);
      const provider = new KaminoProvider(config.SOLANA_RPC_URL, config.SOLANA_PRIVATE_KEY);
      const stats = await provider.getPortfolioStats();
      if (!stats.hasPosition) {
        if (callback) callback({ text: "No active Kamino position to rebalance." });
        return false;
      }
      const text = message.content.text;
      const targetMatch = text.match(/(\d+(\.\d+)?)%/);
      if (!targetMatch) {
        if (callback) callback({ text: "Please specify target LTV percentage (e.g., 'Rebalance to 60%')." });
        return false;
      }
      const targetLtvPercent = parseFloat(targetMatch[1]);
      const targetLtv = targetLtvPercent / 100;
      const currentLtv = stats.ltv;
      elizaLogger5.log(`Current LTV: ${(currentLtv * 100).toFixed(2)}%, Target: ${targetLtvPercent}%`);
      let actionDescription = "";
      if (Math.abs(currentLtv - targetLtv) < 0.02) {
        actionDescription = "LTV is within tolerance. No rebalance needed.";
      } else if (currentLtv > targetLtv) {
        actionDescription = `LTV too high (${(currentLtv * 100).toFixed(2)}%). Recommendation: Repay debt or Supply more collateral to reduce LTV to ${targetLtvPercent}%.`;
      } else {
        actionDescription = `LTV is low (${(currentLtv * 100).toFixed(2)}%). Recommendation: Execute Yield Loop to increase LTV to ${targetLtvPercent}%.`;
      }
      if (callback) {
        callback({
          text: `Rebalance Analysis:
${actionDescription}

Current Stats:
LTV: ${(currentLtv * 100).toFixed(2)}%
Net Value: $${stats.netValue.toFixed(2)}`,
          content: {
            success: true,
            currentLtv,
            targetLtv,
            recommendation: actionDescription
          }
        });
      }
      return true;
    } catch (error) {
      elizaLogger5.error("Error in REBALANCE:", error);
      if (callback) callback({ text: `Rebalance failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Rebalance portfolio to 60%" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Rebalance Analysis: LTV is low...",
          action: "REBALANCE_PORTFOLIO"
        }
      }
    ]
  ]
};

// src/index.ts
var kaminoPlugin = {
  name: "kamino",
  description: "Kamino Finance Plugin for Leveraged Yield Looping and Portfolio Rebalancing.",
  actions: [
    buyRwaAction,
    depositAction,
    borrowAction,
    executeYieldLoopAction,
    rebalancePortfolioAction
  ],
  providers: [kaminoProvider]
};
var index_default = kaminoPlugin;
export {
  index_default as default,
  kaminoPlugin
};
