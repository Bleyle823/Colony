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

interface RPCEndpoint {
    name: string;
    url: string;
    priority: number; // Lower number = higher priority
}

export class EnhancedUniswapService extends Service {
    static serviceType = "enhanced-uniswap";
    capabilityDescription = "Enhanced Uniswap V4 Swapping Service with Robust RPC Handling";
    private providers: Map<string, ethers.JsonRpcProvider> = new Map();
    private wallet: ethers.Wallet | null = null;
    private rpcEndpoints: RPCEndpoint[] = [];
    private currentProvider: ethers.JsonRpcProvider | null = null;

    async stop(): Promise<void> {
        this.providers.clear();
        this.wallet = null;
        this.currentProvider = null;
        this.rpcEndpoints = [];
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        // Configure RPC endpoints with fallbacks
        this.setupRPCEndpoints(runtime);
        
        // Initialize providers
        await this.initializeProviders();
        
        // Setup wallet
        await this.setupWallet(runtime);
        
        logger.info(`Enhanced Uniswap Service initialized with ${this.providers.size} RPC providers`);
    }

    private setupRPCEndpoints(runtime: IAgentRuntime): void {
        const endpoints: RPCEndpoint[] = [];
        
        // Primary endpoints from configuration
        const primaryRPC = runtime.getSetting("UNISWAP_RPC_URL") || 
                          runtime.getSetting("ETHEREUM_RPC_URL") || 
                          runtime.getSetting("ETHEREUM_PROVIDER_URL");
        
        if (primaryRPC) {
            endpoints.push({ name: "Primary", url: primaryRPC, priority: 1 });
        }
        
        // Backup endpoints from configuration
        const backupRPC1 = runtime.getSetting("ETHEREUM_RPC_URL_BACKUP");
        const backupRPC2 = runtime.getSetting("ETHEREUM_RPC_URL_BACKUP2");
        
        if (backupRPC1) {
            endpoints.push({ name: "Backup1", url: backupRPC1, priority: 2 });
        }
        if (backupRPC2) {
            endpoints.push({ name: "Backup2", url: backupRPC2, priority: 3 });
        }
        
        // Additional reliable public endpoints as fallbacks
        endpoints.push(
            { name: "Cloudflare", url: "https://cloudflare-eth.com", priority: 4 },
            { name: "PublicNode", url: "https://ethereum.publicnode.com", priority: 5 },
            { name: "LlamaRPC", url: "https://eth.llamarpc.com", priority: 6 }
        );
        
        // Sort by priority
        this.rpcEndpoints = endpoints.sort((a, b) => a.priority - b.priority);
        
        logger.info(`Configured ${this.rpcEndpoints.length} RPC endpoints`);
    }

    private async initializeProviders(): Promise<void> {
        const workingProviders: RPCEndpoint[] = [];
        
        for (const endpoint of this.rpcEndpoints) {
            try {
                const provider = new ethers.JsonRpcProvider(endpoint.url);
                
                // Test connectivity with timeout
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                );
                
                const testPromise = provider.getNetwork();
                const network = await Promise.race([testPromise, timeoutPromise]) as any;
                
                // Verify it's Ethereum mainnet (chain ID 1)
                if (network.chainId === 1n) {
                    this.providers.set(endpoint.name, provider);
                    workingProviders.push(endpoint);
                    logger.info(`✅ ${endpoint.name} RPC working (${endpoint.url})`);
                    
                    // Set the first working provider as current
                    if (!this.currentProvider) {
                        this.currentProvider = provider;
                        logger.info(`Using ${endpoint.name} as primary RPC provider`);
                    }
                } else {
                    logger.warn(`⚠️ ${endpoint.name} connected to wrong network (Chain ID: ${network.chainId})`);
                }
                
            } catch (error) {
                logger.warn(`❌ ${endpoint.name} RPC failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        if (workingProviders.length === 0) {
            throw new Error("No working RPC endpoints found. Please check your internet connection and RPC configuration.");
        }
        
        logger.info(`Successfully initialized ${workingProviders.length} working RPC providers`);
    }

    private async setupWallet(runtime: IAgentRuntime): Promise<void> {
        const privateKey = runtime.getSetting("EVM_PRIVATE_KEY") || runtime.getSetting("WALLET_PRIVATE_KEY");
        
        if (!privateKey) {
            logger.warn("No private key configured - read-only mode");
            return;
        }
        
        if (!this.currentProvider) {
            throw new Error("No working RPC provider available for wallet setup");
        }
        
        try {
            const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            this.wallet = new ethers.Wallet(formattedKey, this.currentProvider);
            
            // Test wallet by checking balance
            const balance = await this.wallet.provider.getBalance(this.wallet.address);
            logger.info(`Wallet initialized: ${this.wallet.address} (${ethers.formatEther(balance)} ETH)`);
            
        } catch (error) {
            throw new Error(`Failed to initialize wallet: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async executeWithRetry<T>(
        operation: (provider: ethers.JsonRpcProvider) => Promise<T>,
        maxRetries: number = 3,
        operationName: string = "RPC call"
    ): Promise<T> {
        const providers = Array.from(this.providers.values());
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            for (const provider of providers) {
                try {
                    logger.debug(`${operationName} attempt ${attempt + 1} with provider`);
                    const result = await operation(provider);
                    
                    // Update current provider if this one worked
                    this.currentProvider = provider;
                    
                    return result;
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    logger.warn(`${operationName} failed with provider: ${lastError.message}`);
                    
                    // If it's a "no response" error, try next provider immediately
                    if (lastError.message.includes('no response') || 
                        lastError.message.includes('timeout') ||
                        lastError.message.includes('TIMEOUT')) {
                        continue;
                    }
                    
                    // For other errors, might be worth retrying with same provider
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
                    }
                }
            }
        }
        
        throw new Error(`${operationName} failed after ${maxRetries} attempts across all providers. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Get a quote for swapping tokenIn to tokenOut
     */
    async getQuote(tokenInSymbol: string, tokenOutSymbol: string, amountIn: string): Promise<string> {
        const tokenIn = getTokenBySymbol(tokenInSymbol);
        const tokenOut = getTokenBySymbol(tokenOutSymbol);

        if (!tokenIn || !tokenOut) {
            throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
        }

        return await this.executeWithRetry(async (provider) => {
            const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTE_ABI, provider);

            // Construct PoolKey (Simplified assuming direct pool exists with standard fee)
            const poolKey = {
                currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
                currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
                fee: 3000, // Default 0.3%
                tickSpacing: 60,
                hooks: ethers.ZeroAddress
            };

            const zeroForOne = tokenIn.address === poolKey.currency0;
            const amountInParsed = ethers.parseUnits(amountIn, tokenIn.decimals);

            // Using callStatic to simulate
            const result = await quoter.quoteExactInputSingle.staticCall(
                poolKey,
                zeroForOne,
                amountInParsed,
                "0x" // No hook data
            );

            return ethers.formatUnits(result.amountOut, tokenOut.decimals);
        }, 3, `Quote for ${tokenInSymbol} -> ${tokenOutSymbol}`);
    }

    /**
     * Execute a swap using SwapRouter02 (Uniswap V3) with enhanced error handling
     */
    async executeSwap(tokenInSymbol: string, tokenOutSymbol: string, amountIn: string): Promise<string> {
        if (!this.wallet) throw new Error("Wallet not initialized with private key");

        const tokenIn = getTokenBySymbol(tokenInSymbol);
        const tokenOut = getTokenBySymbol(tokenOutSymbol);

        if (!tokenIn || !tokenOut) {
            throw new Error(`Token configuration not found for ${tokenInSymbol} or ${tokenOutSymbol}`);
        }

        const SWAP_ROUTER_02_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
        const amountInWei = ethers.parseUnits(amountIn, tokenIn.decimals);

        // 1. Check Balance and Allowance with retry
        if (tokenInSymbol !== 'ETH' && tokenInSymbol !== 'WETH') {
            await this.executeWithRetry(async (provider) => {
                // Update wallet provider to current working provider
                this.wallet = new ethers.Wallet(this.wallet!.privateKey, provider);
                
                const tokenContract = new ethers.Contract(tokenIn.address, [
                    "function balanceOf(address) view returns (uint256)",
                    "function allowance(address, address) view returns (uint256)",
                    "function approve(address, uint256) returns (bool)"
                ], this.wallet);

                // Verify contract exists
                const code = await provider.getCode(tokenIn.address);
                if (code === '0x') {
                    throw new Error(`Token contract ${tokenInSymbol} not found at ${tokenIn.address} on this chain`);
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
                
                return true; // Success indicator
            }, 3, `Balance and allowance check for ${tokenInSymbol}`);
        } else if (tokenInSymbol === 'ETH') {
            await this.executeWithRetry(async (provider) => {
                const balance = await provider.getBalance(this.wallet!.address);
                if (balance < amountInWei) {
                    throw new Error(`Insufficient ETH balance. Have ${ethers.formatEther(balance)}, need ${amountIn}`);
                }
                return true;
            }, 3, "ETH balance check");
        }

        // 2. Execute Swap with retry
        logger.info(`Executing swap: ${amountIn} ${tokenInSymbol} -> ${tokenOutSymbol}`);

        return await this.executeWithRetry(async (provider) => {
            // Update wallet provider to current working provider
            this.wallet = new ethers.Wallet(this.wallet!.privateKey, provider);
            
            const router = new ethers.Contract(SWAP_ROUTER_02_ADDRESS, [
                "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
            ], this.wallet);

            const params = {
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                fee: 3000, // 0.3% pool fee
                recipient: this.wallet.address,
                amountIn: amountInWei,
                amountOutMinimum: 0, // No slippage protection for demo simplicity
                sqrtPriceLimitX96: 0
            };

            const overrides = tokenInSymbol === 'ETH' ? { value: amountInWei } : {};

            const tx = await router.exactInputSingle(params, overrides);
            logger.info(`Swap transaction sent: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();
            logger.info(`Swap confirmed in block ${receipt.blockNumber}`);

            return tx.hash;
        }, 2, `Swap execution for ${tokenInSymbol} -> ${tokenOutSymbol}`); // Fewer retries for actual transactions
    }
}