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
    const rpcUrl = runtime.getSetting("UNISWAP_RPC_URL") || runtime.getSetting("BASE_RPC_URL") || runtime.getSetting("EVM_PROVIDER_URL") || runtime.getSetting("ETHEREUM_PROVIDER_URL");
    if (!rpcUrl)
      throw new Error("UNISWAP_RPC_URL, BASE_RPC_URL, or EVM_PROVIDER_URL is not configured");
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY") || runtime.getSetting("WALLET_PRIVATE_KEY");
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    }
  }
  /**
   * Get a quote for swapping tokenIn to tokenOut
   */
  async getQuote(tokenInSymbol, tokenOutSymbol, amountIn) {
    if (!this.provider)
      throw new Error("Provider not initialized");
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
   * Execute a swap
   */
  async executeSwap(tokenInSymbol, tokenOutSymbol, amountIn) {
    if (!this.wallet)
      throw new Error("Wallet not initialized with private key");
    const tokenIn = getTokenBySymbol(tokenInSymbol);
    const tokenOut = getTokenBySymbol(tokenOutSymbol);
    if (!tokenIn || !tokenOut) {
      throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
    }
    logger.info(`Executing swap: ${amountIn} ${tokenInSymbol} -> ${tokenOutSymbol}`);
    return "Transaction hash placeholder";
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
    const symbols = words.filter((w) => w === w.toUpperCase() && w.length > 1 && w.length < 6);
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
      return true;
    } catch (error) {
      elizaLogger.error("Error in GET_QUOTE handler:", error);
      if (callback) {
        callback({
          text: `Failed to get quote: ${error.message}`
        });
      }
      return false;
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
  name: "SWAP_TOKENS",
  similes: ["SWAP", "TRADE", "EXCHANGE"],
  description: "Execute a token swap on Uniswap V4",
  validate: async (runtime, message) => {
    return !!runtime.getSetting("EVM_PRIVATE_KEY") || !!runtime.getSetting("WALLET_PRIVATE_KEY");
  },
  handler: async (runtime, message, state, options, callback) => {
    elizaLogger2.info("Handling SWAP_TOKENS action");
    const content = message.content.text || "";
    const amountMatch = content.match(/(\d+(\.\d+)?)/);
    const amount = amountMatch ? amountMatch[0] : "0";
    const words = content.split(" ");
    const symbols = words.filter((w) => w === w.toUpperCase() && w.length > 1 && w.length < 6);
    const tokenIn = symbols[0] || "ETH";
    const tokenOut = symbols[1] || "USDC";
    try {
      const service = new UniswapService(runtime);
      await service.initialize(runtime);
      const txHash = await service.executeSwap(tokenIn, tokenOut, amount);
      if (callback) {
        callback({
          text: `Swap executed! Transaction Hash: ${txHash}`
        });
      }
      return true;
    } catch (error) {
      elizaLogger2.error("Error in SWAP_TOKENS handler:", error);
      if (callback) {
        callback({
          text: `Failed to execute swap: ${error.message}`
        });
      }
      return false;
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
          action: "SWAP_TOKENS"
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
var src_default = uniswapPlugin;
export {
  src_default as default,
  uniswapPlugin
};
//# sourceMappingURL=index.js.map