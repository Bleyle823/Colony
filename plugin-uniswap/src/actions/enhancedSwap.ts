import { Action, ActionResult, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { EnhancedUniswapService } from "../services/enhancedUniswapService";
import { getTokenBySymbol } from "../services/tokens";

export const enhancedSwapTokensAction: Action = {
    name: "ENHANCED_EVM_SWAP_TOKENS",
    similes: ["SWAP_TOKENS", "SWAP", "TRADE", "EXCHANGE", "UNISWAP_SWAP"],
    description: "Execute a token swap on Uniswap with enhanced reliability and error handling",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return !!runtime.getSetting("EVM_PRIVATE_KEY") || !!runtime.getSetting("WALLET_PRIVATE_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        options: { [key: string]: any },
        callback?: HandlerCallback
    ) => {
        elizaLogger.info("Handling ENHANCED_EVM_SWAP_TOKENS action");

        const content = message.content.text || "";
        
        // Enhanced parsing to handle various input formats
        const parseSwapRequest = (text: string) => {
            // Remove common words and normalize
            const normalized = text.toLowerCase()
                .replace(/\b(swap|trade|exchange|convert|sell|buy)\b/g, '')
                .replace(/\b(to|for|into|→|->)\b/g, ' TO ')
                .trim();
            
            // Extract amount - look for decimal numbers
            const amountMatch = normalized.match(/(\d+(?:\.\d+)?)/);
            const amount = amountMatch ? amountMatch[1] : "0";
            
            // Remove amount from text for token parsing
            const textWithoutAmount = normalized.replace(amount, '').trim();
            
            // Split by 'TO' to get input and output tokens
            const parts = textWithoutAmount.split(' to ');
            
            let tokenIn = '';
            let tokenOut = '';
            
            if (parts.length >= 2) {
                // Format: "X ETH TO USDC"
                const beforeTo = parts[0].trim().split(/\s+/);
                const afterTo = parts[1].trim().split(/\s+/);
                
                tokenIn = beforeTo[beforeTo.length - 1]; // Last word before TO
                tokenOut = afterTo[0]; // First word after TO
            } else {
                // Fallback: look for known tokens in the text
                const words = textWithoutAmount.split(/\s+/).filter(w => w.length > 0);
                const tokens = words.filter(w => getTokenBySymbol(w.toUpperCase()));
                
                if (tokens.length >= 2) {
                    tokenIn = tokens[0];
                    tokenOut = tokens[1];
                } else if (tokens.length === 1) {
                    // Assume swapping to USDC if only one token mentioned
                    tokenIn = tokens[0];
                    tokenOut = 'USDC';
                }
            }
            
            return {
                amount: parseFloat(amount),
                tokenIn: tokenIn.toUpperCase(),
                tokenOut: tokenOut.toUpperCase()
            };
        };

        const swapRequest = parseSwapRequest(content);
        
        elizaLogger.info(`Parsed swap request:`, swapRequest);

        // Validation
        if (!swapRequest.amount || isNaN(swapRequest.amount) || swapRequest.amount <= 0) {
            const errorMsg = "Please specify a valid positive amount to swap (e.g., 'Swap 0.1 ETH to USDC' or 'Trade 100 USDC for ETH')";
            if (callback) {
                callback({ text: errorMsg });
            }
            return { success: false, error: "Invalid or missing swap amount" };
        }

        // Default tokens if not specified
        if (!swapRequest.tokenIn) swapRequest.tokenIn = "ETH";
        if (!swapRequest.tokenOut) swapRequest.tokenOut = "USDC";

        // Verify tokens exist
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
            elizaLogger.info(`Initializing Enhanced Uniswap Service...`);
            const service = new EnhancedUniswapService();
            await service.initialize(runtime);

            elizaLogger.info(`Executing swap: ${swapRequest.amount} ${swapRequest.tokenIn} -> ${swapRequest.tokenOut}`);
            
            // Provide user feedback
            if (callback) {
                callback({
                    text: `🔄 Executing swap: ${swapRequest.amount} ${swapRequest.tokenIn} → ${swapRequest.tokenOut}\n\nThis may take a moment while we find the best route and execute the transaction...`
                });
            }

            const txHash = await service.executeSwap(
                swapRequest.tokenIn, 
                swapRequest.tokenOut, 
                swapRequest.amount.toString()
            );

            const successMsg = `✅ Swap executed successfully!\n\n` +
                             `📊 ${swapRequest.amount} ${swapRequest.tokenIn} → ${swapRequest.tokenOut}\n` +
                             `🔗 Transaction: ${txHash}\n` +
                             `🌐 View on Etherscan: https://etherscan.io/tx/${txHash}`;

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

        } catch (error: any) {
            elizaLogger.error("Error in ENHANCED_EVM_SWAP_TOKENS handler:", error);
            
            // Enhanced error messages
            let errorMessage = "Failed to execute swap";
            
            if (error.message.includes('insufficient funds') || error.message.includes('Insufficient')) {
                errorMessage = `❌ Insufficient ${swapRequest.tokenIn} balance for this swap. Please check your wallet balance.`;
            } else if (error.message.includes('no response') || error.message.includes('timeout')) {
                errorMessage = `❌ Network connectivity issue. The RPC provider is not responding. Please try again in a moment.`;
            } else if (error.message.includes('slippage') || error.message.includes('price')) {
                errorMessage = `❌ Swap failed due to price movement. Try again with a smaller amount or higher slippage tolerance.`;
            } else if (error.message.includes('allowance') || error.message.includes('approve')) {
                errorMessage = `❌ Token approval failed. Please ensure you have enough ETH for gas fees and try again.`;
            } else if (error.message.includes('No working RPC')) {
                errorMessage = `❌ All RPC endpoints are currently unavailable. Please check your internet connection and try again later.`;
            } else if (error.message.includes('not found') || error.message.includes('contract')) {
                errorMessage = `❌ Token contract not found. Please verify the token symbols are correct.`;
            } else {
                errorMessage = `❌ Swap failed: ${error.message}`;
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
                content: { text: "Swap 0.1 ETH to USDC" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "🔄 Executing swap: 0.1 ETH → USDC\n\nThis may take a moment while we find the best route and execute the transaction...",
                    action: "ENHANCED_EVM_SWAP_TOKENS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Trade 100 USDC for ETH" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "🔄 Executing swap: 100 USDC → ETH\n\nThis may take a moment while we find the best route and execute the transaction...",
                    action: "ENHANCED_EVM_SWAP_TOKENS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Exchange 0.5 ETH to DAI" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "🔄 Executing swap: 0.5 ETH → DAI\n\nThis may take a moment while we find the best route and execute the transaction...",
                    action: "ENHANCED_EVM_SWAP_TOKENS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Swap 500 USDC to APPLON" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "🔄 Executing swap: 500 USDC → APPLON (Apple stock)\n\nThis may take a moment while we find the best route and execute the transaction...",
                    action: "ENHANCED_EVM_SWAP_TOKENS",
                },
            },
        ],
    ],
};