import { Service, IAgentRuntime, logger } from "@elizaos/core";
import { ethers } from "ethers";
import { SwapExactInSingle, PoolKey, SwapExactIn } from '@uniswap/v4-sdk';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { getTokenBySymbol, ETH_TOKEN, USDC_TOKEN } from "./tokens";

// CONSTANTS (Replace with actual deployment addresses for the target chain)
const QUOTER_ADDRESS = "0x0000000000000000000000000000000000000000"; // TODO: Update
const UNIVERSAL_ROUTER_ADDRESS = "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af"; // TODO: Update
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // TODO: Update

// Minimal ABI for Quoter
const QUOTE_ABI = [
    "function quoteExactInputSingle(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) external returns (uint256 amountOut, uint128 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
    "function quoteExactInput(bytes path, uint128 amountIn) external returns (uint256 amountOut, uint128[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)"
];

export class UniswapService extends Service {
    static serviceType = "uniswap";
    capabilityDescription = "Uniswap V4 Swapping Service";
    private provider: ethers.JsonRpcProvider | null = null;
    private wallet: ethers.Wallet | null = null;

    async stop(): Promise<void> {
        this.provider = null;
        this.wallet = null;
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        const rpcUrl =
            runtime.getSetting("UNISWAP_RPC_URL") ||
            runtime.getSetting("BASE_RPC_URL") ||
            runtime.getSetting("EVM_PROVIDER_URL") ||
            runtime.getSetting("ETHEREUM_PROVIDER_URL");

        if (!rpcUrl) throw new Error("UNISWAP_RPC_URL, BASE_RPC_URL, or EVM_PROVIDER_URL is not configured");

        this.provider = new ethers.JsonRpcProvider(rpcUrl);

        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY") || runtime.getSetting("WALLET_PRIVATE_KEY");
        if (privateKey) {
            this.wallet = new ethers.Wallet(privateKey, this.provider);
        }
    }

    /**
     * Get a quote for swapping tokenIn to tokenOut
     */
    async getQuote(tokenInSymbol: string, tokenOutSymbol: string, amountIn: string): Promise<string> {
        if (!this.provider) throw new Error("Provider not initialized");

        const tokenIn = getTokenBySymbol(tokenInSymbol);
        const tokenOut = getTokenBySymbol(tokenOutSymbol);

        if (!tokenIn || !tokenOut) {
            throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
        }

        const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTE_ABI, this.provider);

        // Construct PoolKey (Simplified assuming direct pool exists with standard fee)
        // In reality, we might need to find the best pool or route.
        const poolKey = {
            currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
            currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
            fee: 3000, // Default 0.3%
            tickSpacing: 60,
            hooks: ethers.ZeroAddress
        };

        const zeroForOne = tokenIn.address === poolKey.currency0;
        const amountInParsed = ethers.parseUnits(amountIn, tokenIn.decimals);

        try {
            // Using callStatic to simulate
            const result = await quoter.quoteExactInputSingle.staticCall(
                poolKey,
                zeroForOne,
                amountInParsed,
                "0x" // No hook data
            );

            const amountOut = ethers.formatUnits(result.amountOut, tokenOut.decimals);
            return amountOut;
        } catch (error: any) {
            logger.error("Error fetching quote:", error);
            throw new Error(`Failed to fetch quote: ${error.message}`);
        }
    }

    /**
     * Execute a swap
     */
    async executeSwap(tokenInSymbol: string, tokenOutSymbol: string, amountIn: string): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized with private key");

        const tokenIn = getTokenBySymbol(tokenInSymbol);
        const tokenOut = getTokenBySymbol(tokenOutSymbol);

        if (!tokenIn || !tokenOut) {
            throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
        }

        // Implementation of swap execution would go here using Universal Router
        // This requires generating the calldata similar to the guide provided
        // For now, returning a placeholder as we need the full router SDK integration

        logger.info(`Executing swap: ${amountIn} ${tokenInSymbol} -> ${tokenOutSymbol}`);

        // TODO: Complete execute logic with V4Planner and UniversalRouter
        return "Transaction hash placeholder";
    }
}
