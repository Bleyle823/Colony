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

// src/index.ts
var uniswapPlugin = {
  name: "uniswap",
  description: "Uniswap V4 Plugin for Swapping and Quoting",
  actions: [
    getQuoteAction,
    swapTokensAction
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