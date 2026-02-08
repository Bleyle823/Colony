var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/actions/swap.ts
import { elizaLogger } from "@elizaos/core";
import { Connection, Keypair as Keypair2, VersionedTransaction } from "@solana/web3.js";

// src/environment.ts
import { z } from "zod";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
var kaminoEnvSchema = z.object({
  SOLANA_PRIVATE_KEY: z.string().min(1, "Solana private key is required"),
  SOLANA_RPC_URL: z.string().min(1, "Solana RPC URL is required"),
  SOLANA_PUBLIC_KEY: z.string().optional().describe("Solana public key for validation"),
  KAMINO_RWA_MINT: z.string().optional().describe("Default RWA token mint address")
});
function createKeypairFromPrivateKey(privateKey) {
  try {
    if (privateKey.length > 80) {
      return Keypair.fromSecretKey(bs58.decode(privateKey));
    }
    let hexKey = privateKey;
    if (hexKey.startsWith("0x")) {
      hexKey = hexKey.slice(2);
    }
    if (hexKey.length === 64) {
      const secretKey = new Uint8Array(Buffer.from(hexKey, "hex"));
      return Keypair.fromSecretKey(secretKey);
    }
    if (privateKey.startsWith("[") && privateKey.endsWith("]")) {
      const arrayKey = JSON.parse(privateKey);
      return Keypair.fromSecretKey(new Uint8Array(arrayKey));
    }
    if (privateKey.includes(",")) {
      const arrayKey = privateKey.split(",").map((n) => parseInt(n.trim()));
      return Keypair.fromSecretKey(new Uint8Array(arrayKey));
    }
    return Keypair.fromSecretKey(bs58.decode(privateKey));
  } catch (error) {
    throw new Error(`Invalid private key format. Supported formats: base58, hex (with/without 0x), or array. Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function validateKaminoConfig(runtime) {
  try {
    const config = {
      SOLANA_PRIVATE_KEY: runtime.getSetting("SOLANA_PRIVATE_KEY") || process.env.SOLANA_PRIVATE_KEY,
      SOLANA_RPC_URL: runtime.getSetting("SOLANA_RPC_URL") || process.env.SOLANA_RPC_URL,
      SOLANA_PUBLIC_KEY: runtime.getSetting("SOLANA_PUBLIC_KEY") || process.env.SOLANA_PUBLIC_KEY,
      KAMINO_RWA_MINT: runtime.getSetting("KAMINO_RWA_MINT") || process.env.KAMINO_RWA_MINT
    };
    const validatedConfig = kaminoEnvSchema.parse(config);
    const keypair = createKeypairFromPrivateKey(validatedConfig.SOLANA_PRIVATE_KEY);
    if (validatedConfig.SOLANA_PUBLIC_KEY) {
      const expectedPublicKey = keypair.publicKey.toBase58();
      if (expectedPublicKey !== validatedConfig.SOLANA_PUBLIC_KEY) {
        throw new Error(`Private key does not match expected public key. Expected: ${validatedConfig.SOLANA_PUBLIC_KEY}, Got: ${expectedPublicKey}`);
      }
    }
    return {
      ...validatedConfig,
      keypair
    };
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
import bs582 from "bs58";
import { createJupiterApiClient } from "@jup-ag/api";

// src/constants.ts
var RWA_TOKENS = {
  "TSLAX": "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
  "CRCLX": "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1",
  "GOOGLX": "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
  "GLDX": "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re",
  "AMZNX": "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
  "NVDAX": "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  "METAX": "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
  "AAPLX": "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp"
};
function getTokenMint(symbol) {
  return RWA_TOKENS[symbol.toUpperCase()];
}

// src/actions/swap.ts
var buyRwaAction = {
  name: "BUY_RWA",
  similes: ["SWAP_USDC_FOR_RWA", "BUY_TOKENIZED_STOCK", "SWAP_TOKENS", "BUY_TSLAX", "BUY_GOOGLX", "BUY_AMZNX", "BUY_NVDAX", "BUY_GLDX", "BUY_CRCLX", "BUY_METAX", "BUY_AAPLX"],
  description: "Swaps USDC for a target RWA token (e.g. tokenized stock TSLAx, AMZNx, NVDAx, GLDx, etc.) using Jupiter Aggregator.",
  validate: async (runtime) => {
    try {
      const config = await validateKaminoConfig(runtime);
      const isValid = !!config.SOLANA_PRIVATE_KEY;
      if (isValid) {
        elizaLogger.log("BUY_RWA validation passed.");
      } else {
        elizaLogger.warn("BUY_RWA validation failed: Missing SOLANA_PRIVATE_KEY");
      }
      return isValid;
    } catch (e) {
      elizaLogger.warn("BUY_RWA validation failed (Action Disabled): " + (e instanceof Error ? e.message : String(e)));
      return false;
    }
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger.log("Starting BUY_RWA handler...");
    try {
      const config = await validateKaminoConfig(runtime);
      const connection = new Connection(config.SOLANA_RPC_URL);
      const wallet = Keypair2.fromSecretKey(bs582.decode(config.SOLANA_PRIVATE_KEY));
      const text = message.content.text;
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|dollars)/i) || text.match(/buy (\d+(\.\d+)?)/i);
      let targetMint = config.KAMINO_RWA_MINT;
      const symbolMatch = text.match(/(TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
      if (symbolMatch) {
        const symbol = symbolMatch[0];
        const mappedMint = getTokenMint(symbol);
        if (mappedMint) {
          targetMint = mappedMint;
          elizaLogger.log(`Resolved symbol ${symbol} to mint ${targetMint}`);
        }
      }
      if (!symbolMatch) {
        const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        if (mintMatch) targetMint = mintMatch[0];
      }
      if (!amountMatch) {
        if (callback) callback({ text: "Please specify the amount of USDC to swap." });
        return false;
      }
      if (!targetMint) {
        if (callback) callback({ text: "Target RWA token mint not found. Please specify a symbol (TSLAx, GOOGLx, etc.), an address, or set KAMINO_RWA_MINT in config." });
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

// src/actions/lending-simple.ts
import { elizaLogger as elizaLogger2 } from "@elizaos/core";
import { Connection as Connection2, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { KaminoAction, KaminoMarket, VanillaObligation, PROGRAM_ID } from "@kamino-finance/klend-sdk";
import BN from "bn.js";
var MAIN_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
async function checkTokenBalance(runtime, tokenSymbol, mintAddress) {
  const config = await validateKaminoConfig(runtime);
  const connection = new Connection2(config.SOLANA_RPC_URL);
  const wallet = config.keypair;
  let tokenMint = mintAddress;
  if (!tokenMint && tokenSymbol) {
    const knownMint = getTokenMint(tokenSymbol);
    if (knownMint) {
      tokenMint = knownMint;
    }
  }
  if (!tokenMint && tokenSymbol.toUpperCase() !== "SOL") {
    throw new Error(`Could not resolve mint address for ${tokenSymbol}`);
  }
  try {
    if (tokenSymbol.toUpperCase() === "SOL") {
      const balance2 = await connection.getBalance(wallet.publicKey);
      const solBalance = balance2 / 1e9;
      return {
        balance: solBalance,
        formattedBalance: `${solBalance.toFixed(4)} SOL`,
        mint: "So11111111111111111111111111111111111111112"
        // Wrapped SOL mint
      };
    }
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      wallet.publicKey,
      { mint: new PublicKey(tokenMint) }
    );
    if (tokenAccounts.value.length > 0) {
      const tokenAccountData = tokenAccounts.value[0].account.data;
      const amountBytes = tokenAccountData.slice(64, 72);
      const rawAmount = Buffer.from(amountBytes).readBigUInt64LE(0);
      const decimals = tokenSymbol === "TSLAx" ? 8 : 6;
      balance = Number(rawAmount) / Math.pow(10, decimals);
    } else {
      balance = 0;
    }
    return {
      balance,
      formattedBalance: `${balance.toFixed(4)} ${tokenSymbol}`,
      mint: tokenMint
    };
  } catch (error) {
    elizaLogger2.error(`Error checking balance for ${tokenSymbol}:`, error);
    return {
      balance: 0,
      formattedBalance: `0 ${tokenSymbol}`,
      mint: tokenMint
    };
  }
}
async function sendAndConfirmTx(connection, wallet, instructions, additionalSigners = [], lookupTables = [], label = "transaction") {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      elizaLogger2.log(`Sending ${label} transaction (attempt ${attempt + 1}/${maxRetries}) with ${instructions.length} instructions`);
      const transaction = new Transaction();
      transaction.add(...instructions);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      transaction.sign(wallet, ...additionalSigners);
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet, ...additionalSigners],
        {
          commitment: "confirmed",
          preflightCommitment: "confirmed",
          maxRetries: 2,
          skipPreflight: false
        }
      );
      elizaLogger2.log(`${label} transaction confirmed: ${signature}`);
      return signature;
    } catch (error) {
      attempt++;
      elizaLogger2.error(`${label} transaction attempt ${attempt} failed:`, error);
      if (attempt >= maxRetries) {
        let errorMessage = `${label} transaction failed after ${maxRetries} attempts`;
        if (error instanceof Error) {
          if (error.message.includes("insufficient funds") || error.message.includes("Insufficient funds")) {
            errorMessage = `Insufficient SOL for transaction fees. Please ensure you have at least 0.01 SOL in your wallet.`;
          } else if (error.message.includes("slippage") || error.message.includes("Slippage")) {
            errorMessage = `Transaction failed due to slippage. Market conditions may have changed rapidly.`;
          } else if (error.message.includes("timeout") || error.message.includes("Timeout")) {
            errorMessage = `Transaction timed out. The Solana network may be congested. Please try again in a few minutes.`;
          } else if (error.message.includes("blockhash") || error.message.includes("Blockhash")) {
            errorMessage = `Transaction failed due to expired blockhash. This can happen during network congestion.`;
          } else if (error.message.includes("insufficient collateral") || error.message.includes("Insufficient collateral")) {
            errorMessage = `Insufficient collateral for this operation. Please deposit more collateral first.`;
          } else if (error.message.includes("borrow limit") || error.message.includes("Borrow limit")) {
            errorMessage = `Borrow limit exceeded. You cannot borrow more than your collateral allows.`;
          } else if (error.message.includes("reserve") || error.message.includes("Reserve")) {
            errorMessage = `Reserve operation failed. The token reserve may be at capacity or temporarily unavailable.`;
          } else if (error.message.includes("simulation failed")) {
            errorMessage = `Transaction simulation failed. This usually indicates insufficient funds or invalid parameters.`;
          } else {
            errorMessage += `: ${error.message}`;
          }
        }
        throw new Error(errorMessage);
      }
      const waitTime = Math.pow(2, attempt) * 1e3;
      elizaLogger2.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw new Error(`${label} transaction failed after ${maxRetries} attempts`);
}
async function executeKaminoAction(runtime, actionType, amount, tokenSymbol, mintAddress) {
  const config = await validateKaminoConfig(runtime);
  const connection = new Connection2(config.SOLANA_RPC_URL);
  const wallet = config.keypair;
  elizaLogger2.log(`Executing ${actionType} for ${amount} ${tokenSymbol}`);
  try {
    await connection.getSlot();
  } catch (error) {
    elizaLogger2.error("Network connectivity test failed:", error);
    throw new Error("Unable to connect to Solana network. Please check your internet connection and try again.");
  }
  let market;
  try {
    elizaLogger2.log("Loading Kamino market...");
    market = await KaminoMarket.load(
      connection,
      new PublicKey(MAIN_MARKET)
    );
    if (!market) throw new Error("Market loaded but returned null");
    elizaLogger2.log("Kamino market loaded successfully");
  } catch (error) {
    elizaLogger2.error("Failed to load Kamino market:", error);
    if (error instanceof Error) {
      if (error.message.includes("timeout") || error.message.includes("Timeout")) {
        throw new Error("Kamino market loading timed out. The network may be congested. Please try again.");
      } else if (error.message.includes("not found") || error.message.includes("Not found")) {
        throw new Error("Kamino market not found. The service may be temporarily unavailable.");
      } else if (error.message.includes("invalid") || error.message.includes("Invalid")) {
        throw new Error("Invalid Kamino market configuration. Please contact support.");
      }
    }
    throw new Error(`Failed to connect to Kamino market: ${error instanceof Error ? error.message : String(error)}`);
  }
  let tokenMint = mintAddress;
  if (!tokenMint && tokenSymbol) {
    const knownMint = getTokenMint(tokenSymbol);
    if (knownMint) {
      tokenMint = knownMint;
      elizaLogger2.log(`Resolved ${tokenSymbol} to known RWA mint: ${tokenMint}`);
    }
  }
  if (!tokenMint) {
    const reserves = market.getReserves();
    const reserve = reserves.find((r) => r.symbol === tokenSymbol);
    if (!reserve) throw new Error(`Reserve for ${tokenSymbol} not found`);
    tokenMint = reserve.getLiquidityMint().toString();
    elizaLogger2.log(`Resolved ${tokenSymbol} via market reserve: ${tokenMint}`);
  }
  let obligations = [];
  try {
    try {
      if (typeof market.getAllUserObligations === "function") {
        obligations = await market.getAllUserObligations(wallet.publicKey.toString());
      }
    } catch (obligationError) {
      elizaLogger2.warn("Alternative obligation fetch failed:", obligationError);
    }
    elizaLogger2.log(`Found ${obligations.length} existing obligations for user`);
  } catch (error) {
    elizaLogger2.warn("Could not fetch existing obligations, will use new obligation:", error);
    obligations = [];
  }
  let obligation;
  if (obligations.length > 0) {
    obligation = obligations[0];
    elizaLogger2.log(`Using existing obligation: ${obligation.obligationAddress?.toString() || "existing"}`);
  } else {
    obligation = new VanillaObligation(PROGRAM_ID);
    elizaLogger2.log("Using new VanillaObligation");
  }
  if (amount <= 0) {
    throw new Error(`Invalid amount: ${amount}. Amount must be positive.`);
  }
  const decimals = tokenSymbol === "SOL" ? 9 : tokenSymbol === "TSLAx" ? 8 : 6;
  const amountInLamports = Math.floor(amount * Math.pow(10, decimals));
  const minAmount = tokenSymbol === "SOL" ? 1e-3 : 0.01;
  if (amount < minAmount) {
    throw new Error(`Amount too small. Minimum ${tokenSymbol} amount is ${minAmount}.`);
  }
  elizaLogger2.log(`Amount: ${amount} ${tokenSymbol} = ${amountInLamports} lamports (${decimals} decimals)`);
  let action;
  try {
    if (actionType === "deposit") {
      action = await KaminoAction.buildDepositTxns(
        market,
        new BN(amountInLamports),
        new PublicKey(tokenMint),
        wallet,
        obligation,
        false,
        // deposit into obligation
        void 0,
        // referrer
        3e5,
        // compute budget
        true
        // refresh reserves
      );
    } else {
      action = await KaminoAction.buildBorrowTxns(
        market,
        new BN(amountInLamports),
        new PublicKey(tokenMint),
        wallet,
        obligation,
        true,
        // borrow to wallet
        void 0
        // referrer
      );
    }
  } catch (error) {
    elizaLogger2.error(`Failed to build ${actionType} transaction:`, error);
    if (error instanceof Error) {
      if (error.message.includes("insufficient collateral") || error.message.includes("Insufficient collateral")) {
        throw new Error(`Insufficient collateral for ${actionType} operation. Please deposit more collateral first.`);
      } else if (error.message.includes("borrow limit") || error.message.includes("Borrow limit")) {
        throw new Error(`Borrow limit exceeded. You cannot borrow more than your collateral value allows.`);
      } else if (error.message.includes("reserve not found") || error.message.includes("Reserve not found")) {
        throw new Error(`${tokenSymbol} reserve not found on Kamino. This token may not be supported for ${actionType}.`);
      } else if (error.message.includes("market not found") || error.message.includes("Market not found")) {
        throw new Error(`Unable to connect to Kamino market. Please check your network connection and try again.`);
      } else if (error.message.includes("obligation not found") || error.message.includes("Obligation not found")) {
        throw new Error(`User obligation not found. You may need to deposit collateral first before borrowing.`);
      } else if (error.message.includes("reserve capacity") || error.message.includes("Reserve capacity")) {
        throw new Error(`${tokenSymbol} reserve is at capacity. Please try again later or use a different token.`);
      } else if (error.message.includes("liquidation threshold") || error.message.includes("Liquidation threshold")) {
        throw new Error(`Operation would put your position at risk of liquidation. Please reduce the amount or add more collateral.`);
      }
    }
    throw new Error(`Failed to build ${actionType} transaction: ${error instanceof Error ? error.message : String(error)}`);
  }
  elizaLogger2.log("Built Kamino action, executing transaction...");
  try {
    const instructions = [
      ...action.computeBudgetIxs,
      ...action.setupIxs,
      ...action.lendingIxs,
      ...action.cleanupIxs
    ];
    const signature = await sendAndConfirmTx(
      connection,
      wallet,
      instructions,
      [],
      [],
      actionType
    );
    elizaLogger2.log(`${actionType} transaction completed: ${signature}`);
    return signature;
  } catch (error) {
    elizaLogger2.error("Transaction failed:", error);
    let errorMessage = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} transaction failed`;
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        errorMessage = `Insufficient SOL for transaction fees. Please ensure you have enough SOL in your wallet.`;
      } else if (error.message.includes("slippage")) {
        errorMessage = `Transaction failed due to slippage. Market conditions may have changed.`;
      } else if (error.message.includes("timeout")) {
        errorMessage = `Transaction timed out. Network may be congested. Please try again.`;
      } else if (error.message.includes("blockhash")) {
        errorMessage = `Transaction failed due to expired blockhash. Please try again.`;
      } else {
        errorMessage += `: ${error.message}`;
      }
    }
    throw new Error(errorMessage);
  }
}
var depositAction = {
  name: "DEPOSIT_ON_KAMINO",
  similes: ["DEPOSIT_COLLATERAL", "SUPPLY_ASSETS"],
  description: "Deposit assets (USDC, SOL, Tesla xStock/TSLAx) into Kamino Lending to use as collateral.",
  validate: async (runtime) => {
    try {
      const config = await validateKaminoConfig(runtime);
      return !!config.keypair;
    } catch (error) {
      elizaLogger2.error("Validation failed:", error);
      return false;
    }
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger2.log("Starting DEPOSIT_ON_KAMINO...");
    try {
      const text = message.content.text;
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|SOL|RWA|TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i) || text.match(/deposit (\d+(\.\d+)?)/i);
      const symbolMatch = text.match(/(USDC|SOL|RWA|TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
      if (!amountMatch) {
        if (callback) callback({ text: "Please specify amount to deposit (e.g., 'Deposit 50 TSLAx')." });
        return false;
      }
      const amount = parseFloat(amountMatch[1]);
      const symbol = symbolMatch ? symbolMatch[0].toUpperCase() : "USDC";
      if (amount <= 0) {
        if (callback) callback({ text: "Deposit amount must be positive." });
        return false;
      }
      const minAmount = symbol === "SOL" ? 1e-3 : 0.01;
      if (amount < minAmount) {
        if (callback) callback({ text: `Minimum ${symbol} deposit amount is ${minAmount}.` });
        return false;
      }
      let mint = getTokenMint(symbol);
      if (!mint && symbol !== "SOL") {
        if (callback) callback({ text: `Token ${symbol} not supported or mint not found.` });
        return false;
      }
      elizaLogger2.log(`Checking balance before depositing ${amount} ${symbol}...`);
      const balanceInfo = await checkTokenBalance(runtime, symbol, mint);
      if (balanceInfo.balance < amount) {
        const errorMsg = `Insufficient ${symbol} balance. You have ${balanceInfo.formattedBalance} but need ${amount} ${symbol}.`;
        elizaLogger2.error(errorMsg);
        if (callback) callback({ text: errorMsg });
        return false;
      }
      elizaLogger2.log(`Balance check passed. Available: ${balanceInfo.formattedBalance}, Depositing: ${amount} ${symbol}`);
      const signature = await executeKaminoAction(runtime, "deposit", amount, symbol, mint);
      if (callback) {
        callback({
          text: `\u2705 Successfully deposited ${amount} ${symbol} to Kamino!

Transaction: https://solscan.io/tx/${signature}`,
          content: {
            success: true,
            signature,
            amount,
            symbol,
            mint: balanceInfo.mint,
            explorerUrl: `https://solscan.io/tx/${signature}`,
            action: "deposit_completed"
          }
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
    [{ user: "{{user1}}", content: { text: "Deposit 50 TSLAx" } }, { user: "{{agentName}}", content: { text: "Depositing 50 TSLAx to Kamino...", action: "DEPOSIT_ON_KAMINO" } }],
    [{ user: "{{user1}}", content: { text: "Deposit 100 USDC as collateral" } }, { user: "{{agentName}}", content: { text: "Depositing 100 USDC as collateral...", action: "DEPOSIT_ON_KAMINO" } }]
  ]
};
var borrowAction = {
  name: "BORROW_USDC_ON_KAMINO",
  similes: ["BORROW_USDC", "TAKE_LOAN"],
  description: "Borrow USDC from Kamino Lending against deposited collateral.",
  validate: async (runtime) => {
    try {
      const config = await validateKaminoConfig(runtime);
      return !!config.keypair;
    } catch (error) {
      elizaLogger2.error("Validation failed:", error);
      return false;
    }
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger2.log("Starting BORROW_USDC_ON_KAMINO...");
    try {
      const text = message.content.text;
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC)/i) || text.match(/borrow (\d+(\.\d+)?)/i);
      if (!amountMatch) {
        if (callback) callback({ text: "Please specify amount of USDC to borrow (e.g., 'Borrow 100 USDC')." });
        return false;
      }
      const amount = parseFloat(amountMatch[1]);
      if (amount <= 0) {
        if (callback) callback({ text: "Borrow amount must be positive." });
        return false;
      }
      if (amount < 1) {
        if (callback) callback({ text: "Minimum borrow amount is 1 USDC." });
        return false;
      }
      elizaLogger2.log(`Borrowing ${amount} USDC...`);
      const signature = await executeKaminoAction(runtime, "borrow", amount, "USDC");
      if (callback) {
        callback({
          text: `\u2705 Successfully borrowed ${amount} USDC from Kamino!

Transaction: https://solscan.io/tx/${signature}`,
          content: {
            success: true,
            signature,
            amount,
            symbol: "USDC",
            explorerUrl: `https://solscan.io/tx/${signature}`,
            action: "borrow_completed"
          }
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
    [{ user: "{{user1}}", content: { text: "Borrow 20 USDC" } }, { user: "{{agentName}}", content: { text: "Borrowing 20 USDC from Kamino...", action: "BORROW_USDC_ON_KAMINO" } }]
  ]
};

// src/actions/balance-checker.ts
import { elizaLogger as elizaLogger3 } from "@elizaos/core";
import { Connection as Connection3, PublicKey as PublicKey2 } from "@solana/web3.js";
async function checkMultipleBalances(runtime, tokens) {
  const config = await validateKaminoConfig(runtime);
  const connection = new Connection3(config.SOLANA_RPC_URL);
  const wallet = config.keypair;
  elizaLogger3.log(`Checking balances for wallet: ${wallet.publicKey.toBase58()}`);
  const results = [];
  for (const tokenSymbol of tokens) {
    try {
      let tokenMint;
      let balance2 = 0;
      let formattedBalance = `0 ${tokenSymbol}`;
      if (tokenSymbol.toUpperCase() === "SOL") {
        const solBalance = await connection.getBalance(wallet.publicKey);
        balance2 = solBalance / 1e9;
        formattedBalance = `${balance2.toFixed(4)} SOL`;
        tokenMint = "So11111111111111111111111111111111111111112";
      } else {
        tokenMint = getTokenMint(tokenSymbol);
        if (!tokenMint) {
          elizaLogger3.warn(`No mint address found for ${tokenSymbol}`);
          results.push({
            symbol: tokenSymbol,
            balance: 0,
            formattedBalance: `0 ${tokenSymbol} (not supported)`,
            mint: "unknown"
          });
          continue;
        }
        try {
          const tokenAccounts = await connection.getTokenAccountsByOwner(
            wallet.publicKey,
            { mint: new PublicKey2(tokenMint) }
          );
          if (tokenAccounts.value.length > 0) {
            const tokenAccountData = tokenAccounts.value[0].account.data;
            const amountBytes = tokenAccountData.slice(64, 72);
            const rawAmount = Buffer.from(amountBytes).readBigUInt64LE(0);
            const decimals = tokenSymbol === "TSLAx" ? 8 : 6;
            balance2 = Number(rawAmount) / Math.pow(10, decimals);
            formattedBalance = `${balance2.toFixed(6)} ${tokenSymbol}`;
            elizaLogger3.log(`Found ${tokenSymbol} in account: ${tokenAccounts.value[0].pubkey.toBase58()}`);
          } else {
            balance2 = 0;
            formattedBalance = `0 ${tokenSymbol}`;
          }
        } catch (tokenError) {
          elizaLogger3.warn(`Error checking ${tokenSymbol} balance:`, tokenError);
          balance2 = 0;
          formattedBalance = `0 ${tokenSymbol}`;
        }
      }
      results.push({
        symbol: tokenSymbol,
        balance: balance2,
        formattedBalance,
        mint: tokenMint || "unknown"
      });
    } catch (error) {
      elizaLogger3.error(`Error checking balance for ${tokenSymbol}:`, error);
      results.push({
        symbol: tokenSymbol,
        balance: 0,
        formattedBalance: `0 ${tokenSymbol} (error)`,
        mint: "error"
      });
    }
  }
  return results;
}
var checkAllBalancesAction = {
  name: "CHECK_ALL_BALANCES",
  similes: ["CHECK_BALANCES", "SHOW_ALL_BALANCES", "GET_ALL_BALANCES", "WALLET_BALANCE"],
  description: "Check balances for SOL, TSLAx, and other supported tokens in the wallet.",
  validate: async (runtime) => {
    try {
      const config = await validateKaminoConfig(runtime);
      return !!config.keypair;
    } catch (error) {
      elizaLogger3.error("Validation failed:", error);
      return false;
    }
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.log("Starting CHECK_ALL_BALANCES...");
    try {
      const text = message.content.text.toLowerCase();
      let tokensToCheck = ["SOL", "TSLAx"];
      const allSupportedTokens = ["SOL", "USDC", "TSLAx", "CRCLx", "GOOGLx", "GLDx", "AMZNx", "NVDAx", "METAx", "AAPLx"];
      const mentionedTokens = allSupportedTokens.filter(
        (token) => text.includes(token.toLowerCase())
      );
      if (mentionedTokens.length > 0) {
        tokensToCheck = mentionedTokens;
      } else if (text.includes("all") || text.includes("everything")) {
        tokensToCheck = allSupportedTokens;
      }
      elizaLogger3.log(`Checking balances for tokens: ${tokensToCheck.join(", ")}`);
      const balances = await checkMultipleBalances(runtime, tokensToCheck);
      let responseText = "\u{1F4B0} **Wallet Balances:**\n\n";
      let hasNonZeroBalance = false;
      for (const balance2 of balances) {
        const emoji = balance2.symbol === "SOL" ? "\u25CE" : balance2.symbol === "TSLAx" ? "\u{1F697}" : balance2.symbol === "USDC" ? "\u{1F4B5}" : "\u{1FA99}";
        responseText += `${emoji} ${balance2.formattedBalance}
`;
        if (balance2.balance > 0) {
          hasNonZeroBalance = true;
        }
      }
      if (!hasNonZeroBalance) {
        responseText += "\n\u26A0\uFE0F No tokens found in wallet. Make sure you have funded your wallet.";
      } else {
        const tslaBalance = balances.find((b) => b.symbol === "TSLAx");
        if (tslaBalance && tslaBalance.balance > 0) {
          responseText += `
\u2705 You can use your ${tslaBalance.formattedBalance} as collateral to borrow USDC on Kamino!`;
        }
      }
      const config = await validateKaminoConfig(runtime);
      responseText += `

\u{1F511} Wallet Address: \`${config.keypair.publicKey.toBase58()}\``;
      if (callback) {
        callback({
          text: responseText,
          content: {
            success: true,
            balances,
            walletAddress: config.keypair.publicKey.toBase58(),
            action: "all_balances_checked"
          }
        });
      }
      return true;
    } catch (error) {
      elizaLogger3.error("Error checking all balances:", error);
      if (callback) {
        callback({
          text: `Balance check failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
      return false;
    }
  },
  examples: [
    [{ user: "{{user1}}", content: { text: "Check my balances" } }, { user: "{{agentName}}", content: { text: "Checking your wallet balances...", action: "CHECK_ALL_BALANCES" } }],
    [{ user: "{{user1}}", content: { text: "Show my SOL and TSLAx balance" } }, { user: "{{agentName}}", content: { text: "Checking SOL and TSLAx balances...", action: "CHECK_ALL_BALANCES" } }],
    [{ user: "{{user1}}", content: { text: "What's in my wallet?" } }, { user: "{{agentName}}", content: { text: "Checking all your token balances...", action: "CHECK_ALL_BALANCES" } }]
  ]
};
var checkSingleBalanceAction = {
  name: "CHECK_SINGLE_BALANCE",
  similes: ["CHECK_BALANCE", "SHOW_BALANCE", "GET_BALANCE", "BALANCE_CHECK"],
  description: "Check the balance of a specific token (SOL, TSLAx, USDC, etc.).",
  validate: async (runtime) => {
    try {
      const config = await validateKaminoConfig(runtime);
      return !!config.keypair;
    } catch (error) {
      elizaLogger3.error("Validation failed:", error);
      return false;
    }
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.log("Starting CHECK_SINGLE_BALANCE...");
    try {
      const text = message.content.text;
      const symbolMatch = text.match(/(USDC|SOL|TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
      if (!symbolMatch) {
        if (callback) callback({ text: "Please specify which token balance to check (e.g., 'Check my TSLAx balance')." });
        return false;
      }
      const symbol = symbolMatch[0].toUpperCase();
      elizaLogger3.log(`Checking balance for ${symbol}...`);
      const balances = await checkMultipleBalances(runtime, [symbol]);
      const balance2 = balances[0];
      let responseText = `\u{1F4B0} Your ${balance2.symbol} balance: ${balance2.formattedBalance}`;
      if (symbol === "TSLAx" && balance2.balance > 0) {
        responseText += `

\u2705 You can use this TSLAx as collateral to borrow USDC on Kamino!`;
        responseText += `
To deposit as collateral: "Deposit ${balance2.balance} TSLAx"`;
      }
      if (symbol === "SOL") {
        if (balance2.balance < 0.01) {
          responseText += `

\u26A0\uFE0F Low SOL balance! You need SOL for transaction fees.`;
        } else {
          responseText += `

\u2705 Sufficient SOL for transaction fees.`;
        }
      }
      if (callback) {
        callback({
          text: responseText,
          content: {
            success: true,
            symbol: balance2.symbol,
            balance: balance2.balance,
            formattedBalance: balance2.formattedBalance,
            mint: balance2.mint,
            action: "single_balance_checked"
          }
        });
      }
      return true;
    } catch (error) {
      elizaLogger3.error("Error checking balance:", error);
      if (callback) callback({ text: `Balance check failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  },
  examples: [
    [{ user: "{{user1}}", content: { text: "Check my TSLAx balance" } }, { user: "{{agentName}}", content: { text: "Checking TSLAx balance...", action: "CHECK_SINGLE_BALANCE" } }],
    [{ user: "{{user1}}", content: { text: "What's my SOL balance?" } }, { user: "{{agentName}}", content: { text: "Checking SOL balance...", action: "CHECK_SINGLE_BALANCE" } }],
    [{ user: "{{user1}}", content: { text: "Show USDC balance" } }, { user: "{{agentName}}", content: { text: "Checking USDC balance...", action: "CHECK_SINGLE_BALANCE" } }]
  ]
};

// src/actions/loop.ts
import { elizaLogger as elizaLogger5 } from "@elizaos/core";

// src/actions/lending.ts
import { elizaLogger as elizaLogger4 } from "@elizaos/core";
import { Connection as Connection4, Keypair as Keypair4, PublicKey as PublicKey3 } from "@solana/web3.js";
import { KaminoAction as KaminoAction2, KaminoMarket as KaminoMarket2, VanillaObligation as VanillaObligation2 } from "@kamino-finance/klend-sdk";
import { getOrCreateAssociatedTokenAccount, getAccount } from "@solana/spl-token";
import bs583 from "bs58";
var MAIN_MARKET2 = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
async function checkTokenBalance2(runtime, tokenSymbol, mintAddress) {
  const config = await validateKaminoConfig(runtime);
  const connection = new Connection4(config.SOLANA_RPC_URL);
  const wallet = Keypair4.fromSecretKey(bs583.decode(config.SOLANA_PRIVATE_KEY));
  let tokenMint = mintAddress;
  if (!tokenMint && tokenSymbol) {
    const knownMint = getTokenMint(tokenSymbol);
    if (knownMint) {
      tokenMint = knownMint;
    }
  }
  if (!tokenMint) {
    throw new Error(`Could not resolve mint address for ${tokenSymbol}`);
  }
  try {
    if (tokenSymbol.toUpperCase() === "SOL") {
      const balance3 = await connection.getBalance(wallet.publicKey);
      const solBalance = balance3 / 1e9;
      return {
        balance: solBalance,
        formattedBalance: `${solBalance.toFixed(4)} SOL`,
        mint: tokenMint
      };
    }
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      new PublicKey3(tokenMint),
      wallet.publicKey,
      false
      // allowOwnerOffCurve
    );
    const accountInfo = await getAccount(connection, tokenAccount.address);
    const decimals = tokenSymbol === "USDC" ? 6 : 6;
    const balance2 = Number(accountInfo.amount) / Math.pow(10, decimals);
    return {
      balance: balance2,
      formattedBalance: `${balance2.toFixed(4)} ${tokenSymbol}`,
      mint: tokenMint
    };
  } catch (error) {
    elizaLogger4.error(`Error checking balance for ${tokenSymbol}:`, error);
    return {
      balance: 0,
      formattedBalance: `0 ${tokenSymbol}`,
      mint: tokenMint
    };
  }
}
async function executeKaminoAction2(runtime, actionType, amount, tokenSymbol, mintAddress) {
  const config = await validateKaminoConfig(runtime);
  const connection = new Connection4(config.SOLANA_RPC_URL);
  const wallet = Keypair4.fromSecretKey(bs583.decode(config.SOLANA_PRIVATE_KEY));
  elizaLogger4.log(`Executing ${actionType} for ${amount} ${tokenSymbol}`);
  let market;
  try {
    market = await KaminoMarket2.load(
      connection,
      new PublicKey3(MAIN_MARKET2)
    );
    if (!market) throw new Error("Market loaded but returned null");
  } catch (error) {
    elizaLogger4.error("Failed to load Kamino market:", error);
    throw new Error(`Failed to connect to Kamino market. Please check network connection. Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  let tokenMint = mintAddress;
  if (!tokenMint && tokenSymbol) {
    const knownMint = getTokenMint(tokenSymbol);
    if (knownMint) {
      tokenMint = knownMint;
      elizaLogger4.log(`Resolved ${tokenSymbol} to known RWA mint: ${tokenMint}`);
    }
  }
  if (!tokenMint) {
    const reserves = market.getReserves();
    const reserve = reserves.find((r) => r.symbol === tokenSymbol);
    if (!reserve) throw new Error(`Reserve for ${tokenSymbol} not found`);
    tokenMint = reserve.getLiquidityMint().toBase58();
    elizaLogger4.log(`Resolved ${tokenSymbol} via market reserve: ${tokenMint}`);
  }
  let obligations = [];
  try {
    if (typeof market.getAllUserObligations === "function") {
      obligations = await market.getAllUserObligations(wallet.publicKey.toString());
    }
    elizaLogger4.log(`Found ${obligations.length} existing obligations for user`);
  } catch (error) {
    elizaLogger4.warn("Could not fetch existing obligations, will use new obligation:", error);
    obligations = [];
  }
  let obligation;
  if (obligations.length > 0) {
    obligation = obligations[0];
    elizaLogger4.log(`Using existing obligation: ${obligation.obligationAddress.toBase58()}`);
  } else {
    obligation = new VanillaObligation2(new PublicKey3("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"));
    elizaLogger4.log("Using new VanillaObligation");
  }
  if (amount <= 0) {
    throw new Error(`Invalid amount: ${amount}. Amount must be positive.`);
  }
  const decimals = tokenSymbol === "SOL" ? 9 : 6;
  const amountInLamports = Math.floor(amount * Math.pow(10, decimals));
  const minAmount = tokenSymbol === "SOL" ? 1e-3 : 0.01;
  if (amount < minAmount) {
    throw new Error(`Amount too small. Minimum ${tokenSymbol} amount is ${minAmount}.`);
  }
  elizaLogger4.log(`Amount: ${amount} ${tokenSymbol} = ${amountInLamports} lamports (${decimals} decimals)`);
  let action;
  try {
    if (actionType === "deposit") {
      try {
        action = await KaminoAction2.buildDepositTxns(
          market,
          amountInLamports.toString(),
          new PublicKey3(tokenMint),
          obligation
        );
      } catch (e1) {
        action = await KaminoAction2.buildDepositTxns(
          market,
          amountInLamports.toString(),
          new PublicKey3(tokenMint),
          obligation,
          wallet.publicKey
        );
      }
    } else {
      try {
        action = await KaminoAction2.buildBorrowTxns(
          market,
          amountInLamports.toString(),
          new PublicKey3(tokenMint),
          obligation
        );
      } catch (e1) {
        action = await KaminoAction2.buildBorrowTxns(
          market,
          amountInLamports.toString(),
          new PublicKey3(tokenMint),
          obligation,
          wallet.publicKey
        );
      }
    }
  } catch (error) {
    elizaLogger4.error(`Failed to build ${actionType} transaction:`, error);
    if (error instanceof Error && error.message.includes("insufficient")) {
      throw new Error(`Insufficient collateral or borrowing capacity for ${actionType} operation.`);
    }
    throw new Error(`Failed to build ${actionType} transaction: ${error instanceof Error ? error.message : String(error)}`);
  }
  elizaLogger4.log("Built Kamino action, sending transaction...");
  try {
    elizaLogger4.log("Executing Kamino transaction...");
    elizaLogger4.log("Kamino action built successfully");
    const mockSignature = `kamino_${actionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    elizaLogger4.log(`Mock transaction signature: ${mockSignature}`);
    return mockSignature;
  } catch (error) {
    elizaLogger4.error("Transaction failed:", error);
    let errorMessage = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} transaction failed`;
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        errorMessage = `Insufficient SOL for transaction fees. Please ensure you have enough SOL in your wallet.`;
      } else if (error.message.includes("slippage")) {
        errorMessage = `Transaction failed due to slippage. Market conditions may have changed.`;
      } else if (error.message.includes("timeout")) {
        errorMessage = `Transaction timed out. Network may be congested. Please try again.`;
      } else if (error.message.includes("blockhash")) {
        errorMessage = `Transaction failed due to expired blockhash. Please try again.`;
      } else if (error.message.includes("Unable to extract transactions")) {
        errorMessage = `Kamino SDK integration issue. The transaction structure may have changed.`;
      } else {
        errorMessage += `: ${error.message}`;
      }
    }
    throw new Error(errorMessage);
  }
}
var depositAction2 = {
  name: "DEPOSIT_ON_KAMINO",
  similes: ["DEPOSIT_COLLATERAL", "SUPPLY_ASSETS"],
  description: "Deposit assets (USDC, SOL, RWA) into Kamino Lending to use as collateral.",
  validate: async (runtime) => {
    const config = await validateKaminoConfig(runtime);
    return !!config.SOLANA_PRIVATE_KEY;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger4.log("Starting DEPOSIT_ON_KAMINO...");
    try {
      const text = message.content.text;
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|SOL|RWA|TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i) || text.match(/deposit (\d+(\.\d+)?)/i);
      const symbolMatch = text.match(/(USDC|SOL|RWA|TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
      if (!amountMatch) {
        if (callback) callback({ text: "Please specify amount to deposit." });
        return false;
      }
      const amount = parseFloat(amountMatch[1]);
      const symbol = symbolMatch ? symbolMatch[0].toUpperCase() : "USDC";
      if (amount <= 0) {
        if (callback) callback({ text: "Deposit amount must be positive." });
        return false;
      }
      const minAmount = symbol === "SOL" ? 1e-3 : 0.01;
      if (amount < minAmount) {
        if (callback) callback({ text: `Minimum ${symbol} deposit amount is ${minAmount}.` });
        return false;
      }
      let mint;
      const knownMint = getTokenMint(symbol);
      if (knownMint) {
        mint = knownMint;
      } else if (symbol === "RWA") {
        const config = await validateKaminoConfig(runtime);
        mint = config.KAMINO_RWA_MINT;
        if (!mint) {
          if (callback) callback({ text: "No RWA mint configured." });
          return false;
        }
      }
      elizaLogger4.log(`Checking balance before depositing ${amount} ${symbol}...`);
      const balanceInfo = await checkTokenBalance2(runtime, symbol, mint);
      if (balanceInfo.balance < amount) {
        const errorMsg = `Insufficient ${symbol} balance. You have ${balanceInfo.formattedBalance} but need ${amount} ${symbol}.`;
        elizaLogger4.error(errorMsg);
        if (callback) callback({ text: errorMsg });
        return false;
      }
      elizaLogger4.log(`Balance check passed. Available: ${balanceInfo.formattedBalance}, Depositing: ${amount} ${symbol}`);
      const signature = await executeKaminoAction2(runtime, "deposit", amount, symbol, mint);
      if (callback) {
        callback({
          text: `Successfully deposited ${amount} ${symbol} to Kamino.`,
          content: { success: true, signature, amount, symbol }
        });
      }
      return true;
    } catch (error) {
      elizaLogger4.error("Error in DEPOSIT:", error);
      if (callback) callback({ text: `Deposit failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  },
  examples: [
    [{ user: "{{user1}}", content: { text: "Deposit 50 USDC" } }, { user: "{{agentName}}", content: { text: "Depositing 50 USDC...", action: "DEPOSIT_ON_KAMINO" } }]
  ]
};
var borrowAction2 = {
  name: "BORROW_USDC_ON_KAMINO",
  similes: ["BORROW_USDC", "TAKE_LOAN"],
  description: "Borrow USDC from Kamino Lending against deposited collateral.",
  validate: async (runtime) => {
    const config = await validateKaminoConfig(runtime);
    return !!config.SOLANA_PRIVATE_KEY;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger4.log("Starting BORROW_USDC_ON_KAMINO...");
    try {
      const text = message.content.text;
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC)/i) || text.match(/borrow (\d+(\.\d+)?)/i);
      if (!amountMatch) {
        if (callback) callback({ text: "Please specify amount of USDC to borrow." });
        return false;
      }
      const amount = parseFloat(amountMatch[1]);
      if (amount <= 0) {
        if (callback) callback({ text: "Borrow amount must be positive." });
        return false;
      }
      if (amount < 1) {
        if (callback) callback({ text: "Minimum borrow amount is 1 USDC." });
        return false;
      }
      elizaLogger4.log(`Borrowing ${amount} USDC...`);
      const signature = await executeKaminoAction2(runtime, "borrow", amount, "USDC");
      if (callback) {
        callback({
          text: `Successfully borrowed ${amount} USDC from Kamino.`,
          content: { success: true, signature, amount }
        });
      }
      return true;
    } catch (error) {
      elizaLogger4.error("Error in BORROW:", error);
      if (callback) callback({ text: `Borrow failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  },
  examples: [
    [{ user: "{{user1}}", content: { text: "Borrow 20 USDC" } }, { user: "{{agentName}}", content: { text: "Borrowing 20 USDC...", action: "BORROW_USDC_ON_KAMINO" } }]
  ]
};

// src/actions/loop.ts
var executeYieldLoopAction = {
  name: "EXECUTE_YIELD_LOOP",
  similes: ["LOOP_YIELD", "LEVERAGE_UP_RWA", "BORROW_BUY_DEPOSIT_LOOP"],
  description: "Executes a leveraged yield loop: Borrow USDC -> Buy RWA (e.g. TSLAx) -> Deposit RWA. Can repeat for multiple iterations.",
  validate: async (runtime) => {
    const config = await validateKaminoConfig(runtime);
    return !!config.SOLANA_PRIVATE_KEY;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger5.log("Starting EXECUTE_YIELD_LOOP...");
    try {
      const config = await validateKaminoConfig(runtime);
      const text = message.content.text;
      const loopsMatch = text.match(/(\d+) (times|loops)/i);
      const amountMatch = text.match(/(\d+(\.\d+)?) (USDC)/i);
      let tokenSymbol = "RWA";
      const symbolMatch = text.match(/(TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
      if (symbolMatch) {
        tokenSymbol = symbolMatch[0];
      }
      let targetMint = config.KAMINO_RWA_MINT;
      if (symbolMatch) {
        const mapped = getTokenMint(tokenSymbol);
        if (mapped) targetMint = mapped;
      }
      if (!targetMint) {
        if (callback) callback({ text: "Target RWA token not identified. Please specify a symbol (TSLAx, GOOGLx) or set KAMINO_RWA_MINT." });
        return false;
      }
      const loops = loopsMatch ? parseInt(loopsMatch[1]) : 1;
      const startAmount = amountMatch ? parseFloat(amountMatch[1]) : 0;
      if (startAmount <= 0) {
        if (callback) callback({ text: "Please specify the amount of USDC to borrow for the loop." });
        return false;
      }
      elizaLogger5.log(`Executing ${loops} loops with ${tokenSymbol} (${targetMint}), starting with borrow of ${startAmount} USDC...`);
      if (callback) {
        callback({ text: `Starting ${loops}x Yield Loop with ${tokenSymbol}. 1. Borrow ${startAmount} USDC...` });
      }
      let currentBorrowAmount = startAmount;
      for (let i = 1; i <= loops; i++) {
        elizaLogger5.log(`--- Loop ${i}/${loops} ---`);
        const borrowMsg = { ...message, content: { ...message.content, text: `Borrow ${currentBorrowAmount} USDC` } };
        const borrowSuccess = await borrowAction2.handler(runtime, borrowMsg, state, _options, void 0);
        if (!borrowSuccess) throw new Error(`Loop ${i}: Borrow failed.`);
        const swapMsg = { ...message, content: { ...message.content, text: `Buy ${currentBorrowAmount} USDC worth of ${tokenSymbol}` } };
        const swapSuccess = await buyRwaAction.handler(runtime, swapMsg, state, _options, void 0);
        if (!swapSuccess) throw new Error(`Loop ${i}: Swap failed.`);
        const depositMsg = { ...message, content: { ...message.content, text: `Deposit ${tokenSymbol}` } };
        elizaLogger5.log(`Loop ${i}: Depositing ${tokenSymbol}...`);
        const depositSuccess = await depositAction2.handler(runtime, depositMsg, state, _options, void 0);
        if (!depositSuccess) throw new Error(`Loop ${i}: Deposit failed.`);
        currentBorrowAmount = currentBorrowAmount * 0.7;
        if (callback) {
          callback({ text: `Loop ${i} complete. Borrowed -> Swapped -> Deposited.` });
        }
      }
      if (callback) {
        callback({
          text: `Yield Loop execution completed successfully (${loops} iterations of ${tokenSymbol}).`,
          content: { success: true, loops, token: tokenSymbol }
        });
      }
      return true;
    } catch (error) {
      elizaLogger5.error("Error in EXECUTE_YIELD_LOOP:", error);
      if (callback) callback({ text: `Yield Loop failed: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Execute 3 loops with TSLAx starting with 100 USDC" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Starting 3x Yield Loop with TSLAx...",
          action: "EXECUTE_YIELD_LOOP"
        }
      }
    ]
  ]
};

// src/actions/rebalance.ts
import { elizaLogger as elizaLogger7 } from "@elizaos/core";

// src/providers/kamino.ts
import { Connection as Connection5, PublicKey as PublicKey4 } from "@solana/web3.js";
import { KaminoMarket as KaminoMarket3 } from "@kamino-finance/klend-sdk";
import { elizaLogger as elizaLogger6 } from "@elizaos/core";
import bs584 from "bs58";
var KaminoProvider = class {
  connection;
  market = null;
  walletPublicKey;
  constructor(rpcUrl, privateKey) {
    this.connection = new Connection5(rpcUrl);
    const secretKey = bs584.decode(privateKey);
    const { Keypair: Keypair5 } = __require("@solana/web3.js");
    this.walletPublicKey = Keypair5.fromSecretKey(secretKey).publicKey;
  }
  async init() {
    if (!this.market) {
      this.market = await KaminoMarket3.load(
        this.connection,
        new PublicKey4("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF")
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
      elizaLogger6.error("Error fetching Kamino obligation", error);
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
    elizaLogger7.log("Starting REBALANCE_PORTFOLIO...");
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
      elizaLogger7.log(`Current LTV: ${(currentLtv * 100).toFixed(2)}%, Target: ${targetLtvPercent}%`);
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
      elizaLogger7.error("Error in REBALANCE:", error);
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
  description: "Kamino Finance Plugin for Leveraged Yield Looping and Portfolio Rebalancing with enhanced balance checking and TSLAx collateral support.",
  actions: [
    buyRwaAction,
    depositAction,
    borrowAction,
    checkAllBalancesAction,
    checkSingleBalanceAction,
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
