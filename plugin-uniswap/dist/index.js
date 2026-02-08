// src/actions/quote.ts
import { elizaLogger } from "@elizaos/core";

// src/services/uniswapService.ts
import { Service, logger } from "@elizaos/core";
import { ethers } from "ethers";

// src/services/tokens.ts
import { Token, ChainId } from "@uniswap/sdk-core";
var CHAIN_ID = ChainId.MAINNET;
var ETH_TOKEN = new Token(
  CHAIN_ID,
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  // WETH on Mainnet
  18,
  "WETH",
  "Wrapped Ether"
);
var USDC_TOKEN = new Token(
  CHAIN_ID,
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  // USDC on Mainnet
  6,
  "USDC",
  "USD Coin"
);
var RWA_TOKENS = {
  "MF-ONE": new Token(
    CHAIN_ID,
    "0x238a700eD6165261Cf8b2e544ba797BC11e466Ba",
    18,
    "mF-ONE",
    "mF-ONE Token"
  ),
  "AA_FalconXUSDC": new Token(
    CHAIN_ID,
    "0xC26A6Fa2C37b38E549a4a1807543801Db684f99C",
    18,
    "AA_FalconXUSDC",
    "AA_FalconXUSDC"
  ),
  "APPLON": new Token(
    CHAIN_ID,
    "0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c",
    18,
    "APPLON",
    "Apple (Ondo Tokenized Stock)"
  ),
  "AAPLON": new Token(
    CHAIN_ID,
    "0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c",
    18,
    "AAPLON",
    "Apple (Ondo Tokenized Stock)"
  ),
  "APPLE": new Token(
    CHAIN_ID,
    "0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c",
    18,
    "APPLE",
    "Apple (Ondo Tokenized Stock)"
  ),
  "xAAPL": new Token(
    CHAIN_ID,
    "0x0000000000000000000000000000000000000002",
    // Placeholder
    18,
    "xAAPL",
    "Wrapped Apple"
  ),
  "xTSLA": new Token(
    CHAIN_ID,
    "0x0000000000000000000000000000000000000003",
    // Placeholder
    18,
    "xTSLA",
    "Wrapped Tesla"
  )
};
var TOKENS = {
  "ETH": ETH_TOKEN,
  "WETH": ETH_TOKEN,
  "USDC": USDC_TOKEN,
  ...RWA_TOKENS
};
var getTokenBySymbol = (symbol) => {
  const normalizedSymbol = symbol.toUpperCase();
  return TOKENS[normalizedSymbol];
};

// src/services/uniswapService.ts
var QUOTER_ADDRESS = "0x0000000000000000000000000000000000000000";
var QUOTE_ABI = [
  "function quoteExactInputSingle(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) external returns (uint256 amountOut, uint128 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactInput(bytes path, uint128 amountIn) external returns (uint256 amountOut, uint128[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)"
];
var UniswapService = class extends Service {
  constructor() {
    super(...arguments);
    this.capabilityDescription = "Uniswap V4 Swapping Service";
    this.provider = null;
    this.wallet = null;
  }
  async stop() {
    this.provider = null;
    this.wallet = null;
  }
  async initialize(runtime) {
    const rpcUrl = runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL") || runtime.getSetting("UNISWAP_RPC_URL") || runtime.getSetting("BASE_RPC_URL");
    if (!rpcUrl) throw new Error("UNISWAP_RPC_URL, BASE_RPC_URL, or EVM_PROVIDER_URL is not configured");
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY") || runtime.getSetting("WALLET_PRIVATE_KEY");
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    }
    const network = await this.provider.getNetwork();
    logger.info(`Uniswap Service initialized on chain ID: ${network.chainId}`);
  }
  /**
   * Get a quote for swapping tokenIn to tokenOut
   */
  async getQuote(tokenInSymbol, tokenOutSymbol, amountIn) {
    if (!this.provider) throw new Error("Provider not initialized");
    const tokenIn = getTokenBySymbol(tokenInSymbol);
    const tokenOut = getTokenBySymbol(tokenOutSymbol);
    if (!tokenIn || !tokenOut) {
      throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
    }
    const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTE_ABI, this.provider);
    const poolKey = {
      currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
      currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
      fee: 3e3,
      // Default 0.3%
      tickSpacing: 60,
      hooks: ethers.ZeroAddress
    };
    const zeroForOne = tokenIn.address === poolKey.currency0;
    const amountInParsed = ethers.parseUnits(amountIn, tokenIn.decimals);
    try {
      const result = await quoter.quoteExactInputSingle.staticCall(
        poolKey,
        zeroForOne,
        amountInParsed,
        "0x"
        // No hook data
      );
      const amountOut = ethers.formatUnits(result.amountOut, tokenOut.decimals);
      return amountOut;
    } catch (error) {
      logger.error("Error fetching quote:", error);
      throw new Error(`Failed to fetch quote: ${error.message}`);
    }
  }
  /**
   * Execute a swap using SwapRouter02 (Uniswap V3)
   */
  async executeSwap(tokenInSymbol, tokenOutSymbol, amountIn) {
    if (!this.wallet) throw new Error("Wallet not initialized with private key");
    const tokenIn = getTokenBySymbol(tokenInSymbol);
    const tokenOut = getTokenBySymbol(tokenOutSymbol);
    if (!tokenIn || !tokenOut) {
      throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
    }
    const SWAP_ROUTER_02_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
    const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);
    if (tokenInSymbol !== "ETH" && tokenInSymbol !== "WETH") {
      const tokenContract = new ethers.Contract(tokenIn.address, [
        "function balanceOf(address) view returns (uint256)",
        "function allowance(address, address) view returns (uint256)",
        "function approve(address, uint256) returns (bool)"
      ], this.wallet);
      const code = await this.provider.getCode(tokenIn.address);
      if (code === "0x") {
        throw new Error(`Token contract ${tokenInSymbol} not found at ${tokenIn.address} on this chain. Check your configuration.`);
      }
      const balance = await tokenContract.balanceOf(this.wallet.address);
      if (balance < amountInWei) {
        throw new Error(`Insufficient balance of ${tokenInSymbol}. Have ${ethers.formatUnits(balance, tokenIn.decimals)}, need ${amountIn}`);
      }
      const allowance = await tokenContract.allowance(this.wallet.address, SWAP_ROUTER_02_ADDRESS);
      if (allowance < amountInWei) {
        logger.info(`Approving ${tokenInSymbol} for Uniswap Router...`);
        const tx = await tokenContract.approve(SWAP_ROUTER_02_ADDRESS, ethers.MaxUint256);
        logger.info(`Approval tx sent: ${tx.hash}`);
        await tx.wait();
        logger.info("Approval confirmed");
      }
    } else if (tokenInSymbol === "ETH") {
      const balance = await this.provider.getBalance(this.wallet.address);
      if (balance < amountInWei) {
        throw new Error(`Insufficient ETH balance. Have ${ethers.formatEther(balance)}, need ${amountIn}`);
      }
    }
    logger.info(`Executing swap: ${amountIn} ${tokenInSymbol} -> ${tokenOutSymbol}`);
    const router = new ethers.Contract(SWAP_ROUTER_02_ADDRESS, [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
    ], this.wallet);
    const params = {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: 3e3,
      // 0.3% pool fee
      recipient: this.wallet.address,
      amountIn: amountInWei,
      amountOutMinimum: 0,
      // No slippage protection for demo simplicity
      sqrtPriceLimitX96: 0
    };
    const overrides = tokenInSymbol === "ETH" ? { value: amountInWei } : {};
    try {
      const tx = await router.exactInputSingle(params, overrides);
      logger.info(`Swap transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`Swap confirmed in block ${receipt.blockNumber}`);
      return tx.hash;
    } catch (error) {
      logger.error("Swap failed executing transaction:", error);
      throw new Error(`Swap transaction failed: ${error.reason || error.message}`);
    }
  }
};
UniswapService.serviceType = "uniswap";

// src/actions/quote.ts
var getQuoteAction = {
  name: "GET_QUOTE",
  similes: ["QUOTE_PRICE", "CHECK_PRICE", "PRICE_CHECK"],
  description: "Get a quote for swapping tokens on Uniswap V4",
  validate: async (runtime, message) => {
    return !!runtime.getSetting("EVM_PRIVATE_KEY") || !!runtime.getSetting("WALLET_PRIVATE_KEY");
  },
  handler: async (runtime, message, state, options, callback) => {
    elizaLogger.info("Handling GET_QUOTE action");
    const content = message.content.text || "";
    const amountMatch = content.match(/(\d+(\.\d+)?)/);
    const amount = amountMatch ? amountMatch[0] : "1";
    const words = content.split(" ");
    const symbols = words.map((w) => w.trim().replace(/[.,]/g, "")).filter((w) => getTokenBySymbol(w));
    const tokenIn = symbols[0] || "ETH";
    const tokenOut = symbols[1] || "USDC";
    try {
      const service = new UniswapService(runtime);
      await service.initialize(runtime);
      const quote = await service.getQuote(tokenIn, tokenOut, amount);
      if (callback) {
        callback({
          text: `Quote: ${amount} ${tokenIn} \u2248 ${quote} ${tokenOut} on Uniswap V4.`
        });
      }
      return { success: true, text: `Quote: ${amount} ${tokenIn} \u2248 ${quote} ${tokenOut}`, data: { amount, tokenIn, tokenOut, quote } };
    } catch (error) {
      elizaLogger.error("Error in GET_QUOTE handler:", error);
      if (callback) {
        callback({
          text: `Failed to get quote: ${error.message}`
        });
      }
      return { success: false, error: error?.message ?? "Unknown error" };
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Get quote for 1 ETH to USDC" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Quote: 1 ETH \u2248 2500 USDC on Uniswap V4.",
          action: "GET_QUOTE"
        }
      }
    ]
  ]
};

// src/actions/swap.ts
import { elizaLogger as elizaLogger2 } from "@elizaos/core";
var swapTokensAction = {
  name: "EVM_SWAP_TOKENS",
  similes: ["SWAP_TOKENS", "SWAP", "TRADE", "EXCHANGE"],
  description: "Execute a token swap on Uniswap V4",
  validate: async (runtime, message) => {
    return !!runtime.getSetting("EVM_PRIVATE_KEY") || !!runtime.getSetting("WALLET_PRIVATE_KEY");
  },
  handler: async (runtime, message, state, options, callback) => {
    elizaLogger2.info("Handling SWAP_TOKENS action");
    const content = message.content.text || "";
    const amountMatch = content.match(/(\d+(\.\d+)?)/);
    const amount = amountMatch ? amountMatch[0] : "0";
    const textWithoutAmount = content.replace(amount, "");
    const words = textWithoutAmount.split(" ");
    const symbols = words.map((w) => w.trim().replace(/[.,]/g, "")).filter((w) => getTokenBySymbol(w));
    let tokenIn = symbols[0];
    let tokenOut = symbols[1];
    if (!tokenIn) tokenIn = "ETH";
    if (!tokenOut) tokenOut = "USDC";
    const amountNum = parseFloat(amount);
    if (!amountMatch || isNaN(amountNum) || amountNum <= 0) {
      if (callback) {
        callback({
          text: "Please specify a valid positive amount to swap (e.g. Swap 0.1 ETH to USDC)."
        });
      }
      return { success: false, error: "Invalid or missing swap amount" };
    }
    try {
      const service = new UniswapService(runtime);
      await service.initialize(runtime);
      const txHash = await service.executeSwap(tokenIn, tokenOut, amount);
      if (callback) {
        callback({
          text: `Swap executed! Transaction Hash: ${txHash}`
        });
      }
      return { success: true, text: `Swap executed. Tx: ${txHash}`, data: { txHash, tokenIn, tokenOut, amount } };
    } catch (error) {
      elizaLogger2.error("Error in SWAP_TOKENS handler:", error);
      if (callback) {
        callback({
          text: `Failed to execute swap: ${error.message}`
        });
      }
      return { success: false, error: error?.message ?? "Unknown error" };
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Swap 0.1 ETH to USDC" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Swap executed! Transaction Hash: 0x...",
          action: "EVM_SWAP_TOKENS"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Swap 1 USDC for MF-ONE" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Swap executed! Transaction Hash: 0x...",
          action: "EVM_SWAP_TOKENS"
        }
      }
    ]
  ]
};

// src/actions/enhancedSwap.ts
import { elizaLogger as elizaLogger3 } from "@elizaos/core";

// src/services/enhancedUniswapService.ts
import { Service as Service2, logger as logger2 } from "@elizaos/core";
import { ethers as ethers2 } from "ethers";
var QUOTER_ADDRESS2 = "0x0000000000000000000000000000000000000000";
var QUOTE_ABI2 = [
  "function quoteExactInputSingle(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) external returns (uint256 amountOut, uint128 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactInput(bytes path, uint128 amountIn) external returns (uint256 amountOut, uint128[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)"
];
var EnhancedUniswapService = class extends Service2 {
  constructor() {
    super(...arguments);
    this.capabilityDescription = "Enhanced Uniswap V4 Swapping Service with Robust RPC Handling";
    this.providers = /* @__PURE__ */ new Map();
    this.wallet = null;
    this.rpcEndpoints = [];
    this.currentProvider = null;
  }
  async stop() {
    this.providers.clear();
    this.wallet = null;
    this.currentProvider = null;
    this.rpcEndpoints = [];
  }
  async initialize(runtime) {
    this.setupRPCEndpoints(runtime);
    await this.initializeProviders();
    await this.setupWallet(runtime);
    logger2.info(`Enhanced Uniswap Service initialized with ${this.providers.size} RPC providers`);
  }
  setupRPCEndpoints(runtime) {
    const endpoints = [];
    const primaryRPC = runtime.getSetting("UNISWAP_RPC_URL") || runtime.getSetting("ETHEREUM_RPC_URL") || runtime.getSetting("ETHEREUM_PROVIDER_URL");
    if (primaryRPC) {
      endpoints.push({ name: "Primary", url: primaryRPC, priority: 1 });
    }
    const backupRPC1 = runtime.getSetting("ETHEREUM_RPC_URL_BACKUP");
    const backupRPC2 = runtime.getSetting("ETHEREUM_RPC_URL_BACKUP2");
    if (backupRPC1) {
      endpoints.push({ name: "Backup1", url: backupRPC1, priority: 2 });
    }
    if (backupRPC2) {
      endpoints.push({ name: "Backup2", url: backupRPC2, priority: 3 });
    }
    endpoints.push(
      { name: "Cloudflare", url: "https://cloudflare-eth.com", priority: 4 },
      { name: "PublicNode", url: "https://ethereum.publicnode.com", priority: 5 },
      { name: "LlamaRPC", url: "https://eth.llamarpc.com", priority: 6 }
    );
    this.rpcEndpoints = endpoints.sort((a, b) => a.priority - b.priority);
    logger2.info(`Configured ${this.rpcEndpoints.length} RPC endpoints`);
  }
  async initializeProviders() {
    const workingProviders = [];
    for (const endpoint of this.rpcEndpoints) {
      try {
        const provider = new ethers2.JsonRpcProvider(endpoint.url);
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Timeout")), 5e3)
        );
        const testPromise = provider.getNetwork();
        const network = await Promise.race([testPromise, timeoutPromise]);
        if (network.chainId === 1n) {
          this.providers.set(endpoint.name, provider);
          workingProviders.push(endpoint);
          logger2.info(`\u2705 ${endpoint.name} RPC working (${endpoint.url})`);
          if (!this.currentProvider) {
            this.currentProvider = provider;
            logger2.info(`Using ${endpoint.name} as primary RPC provider`);
          }
        } else {
          logger2.warn(`\u26A0\uFE0F ${endpoint.name} connected to wrong network (Chain ID: ${network.chainId})`);
        }
      } catch (error) {
        logger2.warn(`\u274C ${endpoint.name} RPC failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (workingProviders.length === 0) {
      throw new Error("No working RPC endpoints found. Please check your internet connection and RPC configuration.");
    }
    logger2.info(`Successfully initialized ${workingProviders.length} working RPC providers`);
  }
  async setupWallet(runtime) {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY") || runtime.getSetting("WALLET_PRIVATE_KEY");
    if (!privateKey) {
      logger2.warn("No private key configured - read-only mode");
      return;
    }
    if (!this.currentProvider) {
      throw new Error("No working RPC provider available for wallet setup");
    }
    try {
      const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers2.Wallet(formattedKey, this.currentProvider);
      const balance = await this.wallet.provider.getBalance(this.wallet.address);
      logger2.info(`Wallet initialized: ${this.wallet.address} (${ethers2.formatEther(balance)} ETH)`);
    } catch (error) {
      throw new Error(`Failed to initialize wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async executeWithRetry(operation, maxRetries = 3, operationName = "RPC call") {
    const providers = Array.from(this.providers.values());
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (const provider of providers) {
        try {
          logger2.debug(`${operationName} attempt ${attempt + 1} with provider`);
          const result = await operation(provider);
          this.currentProvider = provider;
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger2.warn(`${operationName} failed with provider: ${lastError.message}`);
          if (lastError.message.includes("no response") || lastError.message.includes("timeout") || lastError.message.includes("TIMEOUT")) {
            continue;
          }
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1e3 * (attempt + 1)));
          }
        }
      }
    }
    throw new Error(`${operationName} failed after ${maxRetries} attempts across all providers. Last error: ${lastError?.message || "Unknown error"}`);
  }
  /**
   * Get a quote for swapping tokenIn to tokenOut
   */
  async getQuote(tokenInSymbol, tokenOutSymbol, amountIn) {
    const tokenIn = getTokenBySymbol(tokenInSymbol);
    const tokenOut = getTokenBySymbol(tokenOutSymbol);
    if (!tokenIn || !tokenOut) {
      throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
    }
    return await this.executeWithRetry(async (provider) => {
      const quoter = new ethers2.Contract(QUOTER_ADDRESS2, QUOTE_ABI2, provider);
      const poolKey = {
        currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
        currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
        fee: 3e3,
        // Default 0.3%
        tickSpacing: 60,
        hooks: ethers2.ZeroAddress
      };
      const zeroForOne = tokenIn.address === poolKey.currency0;
      const amountInParsed = ethers2.parseUnits(amountIn, tokenIn.decimals);
      const result = await quoter.quoteExactInputSingle.staticCall(
        poolKey,
        zeroForOne,
        amountInParsed,
        "0x"
        // No hook data
      );
      return ethers2.formatUnits(result.amountOut, tokenOut.decimals);
    }, 3, `Quote for ${tokenInSymbol} -> ${tokenOutSymbol}`);
  }
  /**
   * Execute a swap using SwapRouter02 (Uniswap V3) with enhanced error handling
   */
  async executeSwap(tokenInSymbol, tokenOutSymbol, amountIn) {
    if (!this.wallet) throw new Error("Wallet not initialized with private key");
    const tokenIn = getTokenBySymbol(tokenInSymbol);
    const tokenOut = getTokenBySymbol(tokenOutSymbol);
    if (!tokenIn || !tokenOut) {
      throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
    }
    const SWAP_ROUTER_02_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
    const amountInWei = ethers2.parseUnits(amountIn, tokenIn.decimals);
    if (tokenInSymbol !== "ETH" && tokenInSymbol !== "WETH") {
      await this.executeWithRetry(async (provider) => {
        this.wallet = new ethers2.Wallet(this.wallet.privateKey, provider);
        const tokenContract = new ethers2.Contract(tokenIn.address, [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address, address) view returns (uint256)",
          "function approve(address, uint256) returns (bool)"
        ], this.wallet);
        const code = await provider.getCode(tokenIn.address);
        if (code === "0x") {
          throw new Error(`Token contract ${tokenInSymbol} not found at ${tokenIn.address} on this chain`);
        }
        const balance = await tokenContract.balanceOf(this.wallet.address);
        if (balance < amountInWei) {
          throw new Error(`Insufficient balance of ${tokenInSymbol}. Have ${ethers2.formatUnits(balance, tokenIn.decimals)}, need ${amountIn}`);
        }
        const allowance = await tokenContract.allowance(this.wallet.address, SWAP_ROUTER_02_ADDRESS);
        if (allowance < amountInWei) {
          logger2.info(`Approving ${tokenInSymbol} for Uniswap Router...`);
          const tx = await tokenContract.approve(SWAP_ROUTER_02_ADDRESS, ethers2.MaxUint256);
          logger2.info(`Approval tx sent: ${tx.hash}`);
          await tx.wait();
          logger2.info("Approval confirmed");
        }
        return true;
      }, 3, `Balance and allowance check for ${tokenInSymbol}`);
    } else if (tokenInSymbol === "ETH") {
      await this.executeWithRetry(async (provider) => {
        const balance = await provider.getBalance(this.wallet.address);
        if (balance < amountInWei) {
          throw new Error(`Insufficient ETH balance. Have ${ethers2.formatEther(balance)}, need ${amountIn}`);
        }
        return true;
      }, 3, "ETH balance check");
    }
    logger2.info(`Executing swap: ${amountIn} ${tokenInSymbol} -> ${tokenOutSymbol}`);
    return await this.executeWithRetry(async (provider) => {
      this.wallet = new ethers2.Wallet(this.wallet.privateKey, provider);
      const router = new ethers2.Contract(SWAP_ROUTER_02_ADDRESS, [
        "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
      ], this.wallet);
      const params = {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: 3e3,
        // 0.3% pool fee
        recipient: this.wallet.address,
        amountIn: amountInWei,
        amountOutMinimum: 0,
        // No slippage protection for demo simplicity
        sqrtPriceLimitX96: 0
      };
      const overrides = tokenInSymbol === "ETH" ? { value: amountInWei } : {};
      const tx = await router.exactInputSingle(params, overrides);
      logger2.info(`Swap transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      logger2.info(`Swap confirmed in block ${receipt.blockNumber}`);
      return tx.hash;
    }, 2, `Swap execution for ${tokenInSymbol} -> ${tokenOutSymbol}`);
  }
};
EnhancedUniswapService.serviceType = "enhanced-uniswap";

// src/actions/enhancedSwap.ts
var enhancedSwapTokensAction = {
  name: "ENHANCED_EVM_SWAP_TOKENS",
  similes: ["SWAP_TOKENS", "SWAP", "TRADE", "EXCHANGE", "UNISWAP_SWAP"],
  description: "Execute a token swap on Uniswap with enhanced reliability and error handling",
  validate: async (runtime, message) => {
    return !!runtime.getSetting("EVM_PRIVATE_KEY") || !!runtime.getSetting("WALLET_PRIVATE_KEY");
  },
  handler: async (runtime, message, state, options, callback) => {
    elizaLogger3.info("Handling ENHANCED_EVM_SWAP_TOKENS action");
    const content = message.content.text || "";
    const parseSwapRequest = (text) => {
      const normalized = text.toLowerCase().replace(/\b(swap|trade|exchange|convert|sell|buy)\b/g, "").replace(/\b(to|for|into|→|->)\b/g, " TO ").trim();
      const amountMatch = normalized.match(/(\d+(?:\.\d+)?)/);
      const amount = amountMatch ? amountMatch[1] : "0";
      const textWithoutAmount = normalized.replace(amount, "").trim();
      const parts = textWithoutAmount.split(" to ");
      let tokenIn = "";
      let tokenOut = "";
      if (parts.length >= 2) {
        const beforeTo = parts[0].trim().split(/\s+/);
        const afterTo = parts[1].trim().split(/\s+/);
        tokenIn = beforeTo[beforeTo.length - 1];
        tokenOut = afterTo[0];
      } else {
        const words = textWithoutAmount.split(/\s+/).filter((w) => w.length > 0);
        const tokens = words.filter((w) => getTokenBySymbol(w.toUpperCase()));
        if (tokens.length >= 2) {
          tokenIn = tokens[0];
          tokenOut = tokens[1];
        } else if (tokens.length === 1) {
          tokenIn = tokens[0];
          tokenOut = "USDC";
        }
      }
      return {
        amount: parseFloat(amount),
        tokenIn: tokenIn.toUpperCase(),
        tokenOut: tokenOut.toUpperCase()
      };
    };
    const swapRequest = parseSwapRequest(content);
    elizaLogger3.info(`Parsed swap request:`, swapRequest);
    if (!swapRequest.amount || isNaN(swapRequest.amount) || swapRequest.amount <= 0) {
      const errorMsg = "Please specify a valid positive amount to swap (e.g., 'Swap 0.1 ETH to USDC' or 'Trade 100 USDC for ETH')";
      if (callback) {
        callback({ text: errorMsg });
      }
      return { success: false, error: "Invalid or missing swap amount" };
    }
    if (!swapRequest.tokenIn) swapRequest.tokenIn = "ETH";
    if (!swapRequest.tokenOut) swapRequest.tokenOut = "USDC";
    const tokenInConfig = getTokenBySymbol(swapRequest.tokenIn);
    const tokenOutConfig = getTokenBySymbol(swapRequest.tokenOut);
    if (!tokenInConfig) {
      const errorMsg = `Token ${swapRequest.tokenIn} is not supported. Available tokens: ETH, USDC, WETH, DAI, USDT, APPLON, AAPLON, APPLE`;
      if (callback) {
        callback({ text: errorMsg });
      }
      return { success: false, error: `Unsupported input token: ${swapRequest.tokenIn}` };
    }
    if (!tokenOutConfig) {
      const errorMsg = `Token ${swapRequest.tokenOut} is not supported. Available tokens: ETH, USDC, WETH, DAI, USDT, APPLON, AAPLON, APPLE`;
      if (callback) {
        callback({ text: errorMsg });
      }
      return { success: false, error: `Unsupported output token: ${swapRequest.tokenOut}` };
    }
    try {
      elizaLogger3.info(`Initializing Enhanced Uniswap Service...`);
      const service = new EnhancedUniswapService();
      await service.initialize(runtime);
      elizaLogger3.info(`Executing swap: ${swapRequest.amount} ${swapRequest.tokenIn} -> ${swapRequest.tokenOut}`);
      if (callback) {
        callback({
          text: `\u{1F504} Executing swap: ${swapRequest.amount} ${swapRequest.tokenIn} \u2192 ${swapRequest.tokenOut}

This may take a moment while we find the best route and execute the transaction...`
        });
      }
      const txHash = await service.executeSwap(
        swapRequest.tokenIn,
        swapRequest.tokenOut,
        swapRequest.amount.toString()
      );
      const successMsg = `\u2705 Swap executed successfully!

\u{1F4CA} ${swapRequest.amount} ${swapRequest.tokenIn} \u2192 ${swapRequest.tokenOut}
\u{1F517} Transaction: ${txHash}
\u{1F310} View on Etherscan: https://etherscan.io/tx/${txHash}`;
      if (callback) {
        callback({
          text: successMsg
        });
      }
      return {
        success: true,
        text: `Swap executed successfully. Tx: ${txHash}`,
        data: {
          txHash,
          tokenIn: swapRequest.tokenIn,
          tokenOut: swapRequest.tokenOut,
          amount: swapRequest.amount,
          explorerUrl: `https://etherscan.io/tx/${txHash}`
        }
      };
    } catch (error) {
      elizaLogger3.error("Error in ENHANCED_EVM_SWAP_TOKENS handler:", error);
      let errorMessage = "Failed to execute swap";
      if (error.message.includes("insufficient funds") || error.message.includes("Insufficient")) {
        errorMessage = `\u274C Insufficient ${swapRequest.tokenIn} balance for this swap. Please check your wallet balance.`;
      } else if (error.message.includes("no response") || error.message.includes("timeout")) {
        errorMessage = `\u274C Network connectivity issue. The RPC provider is not responding. Please try again in a moment.`;
      } else if (error.message.includes("slippage") || error.message.includes("price")) {
        errorMessage = `\u274C Swap failed due to price movement. Try again with a smaller amount or higher slippage tolerance.`;
      } else if (error.message.includes("allowance") || error.message.includes("approve")) {
        errorMessage = `\u274C Token approval failed. Please ensure you have enough ETH for gas fees and try again.`;
      } else if (error.message.includes("No working RPC")) {
        errorMessage = `\u274C All RPC endpoints are currently unavailable. Please check your internet connection and try again later.`;
      } else if (error.message.includes("not found") || error.message.includes("contract")) {
        errorMessage = `\u274C Token contract not found. Please verify the token symbols are correct.`;
      } else {
        errorMessage = `\u274C Swap failed: ${error.message}`;
      }
      if (callback) {
        callback({
          text: errorMessage
        });
      }
      return { success: false, error: error?.message ?? "Unknown error" };
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Swap 0.1 ETH to USDC" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "\u{1F504} Executing swap: 0.1 ETH \u2192 USDC\n\nThis may take a moment while we find the best route and execute the transaction...",
          action: "ENHANCED_EVM_SWAP_TOKENS"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Trade 100 USDC for ETH" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "\u{1F504} Executing swap: 100 USDC \u2192 ETH\n\nThis may take a moment while we find the best route and execute the transaction...",
          action: "ENHANCED_EVM_SWAP_TOKENS"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Exchange 0.5 ETH to DAI" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "\u{1F504} Executing swap: 0.5 ETH \u2192 DAI\n\nThis may take a moment while we find the best route and execute the transaction...",
          action: "ENHANCED_EVM_SWAP_TOKENS"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Swap 500 USDC to APPLON" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "\u{1F504} Executing swap: 500 USDC \u2192 APPLON (Apple stock)\n\nThis may take a moment while we find the best route and execute the transaction...",
          action: "ENHANCED_EVM_SWAP_TOKENS"
        }
      }
    ]
  ]
};

// src/index.ts
var uniswapPlugin = {
  name: "uniswap",
  description: "Enhanced Uniswap V4 Plugin for Swapping and Quoting with Robust RPC Handling",
  actions: [
    getQuoteAction,
    swapTokensAction,
    enhancedSwapTokensAction
    // Enhanced version with better error handling
  ],
  evaluators: [],
  providers: []
};
var index_default = uniswapPlugin;
export {
  index_default as default,
  uniswapPlugin
};
//# sourceMappingURL=index.js.map