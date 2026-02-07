import { Action, ActionResult, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { UniswapService } from "../services/uniswapService";
import { getTokenBySymbol } from "../services/tokens";

export const swapTokensAction: Action = {
    name: "EVM_SWAP_TOKENS",
    similes: ["SWAP_TOKENS", "SWAP", "TRADE", "EXCHANGE"],
    description: "Execute a token swap on Uniswap V4",
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
        elizaLogger.info("Handling SWAP_TOKENS action");

        const content = message.content.text || "";
        const amountMatch = content.match(/(\d+(\.\d+)?)/);
        const amount = amountMatch ? amountMatch[0] : "0";

        // Remove the amount from the text to avoid confusing it with a token
        const textWithoutAmount = content.replace(amount, "");

        const words = textWithoutAmount.split(" ");
        const symbols = words
            .map(w => w.trim().replace(/[.,]/g, ''))
            .filter(w => getTokenBySymbol(w));

        // Smart fallback logic
        let tokenIn = symbols[0];
        let tokenOut = symbols[1];

        if (!tokenIn) tokenIn = "ETH";
        if (!tokenOut) tokenOut = "USDC";

        const amountNum = parseFloat(amount);
        if (!amountMatch || isNaN(amountNum) || amountNum <= 0) {
            if (callback) {
                callback({
                    text: "Please specify a valid positive amount to swap (e.g. Swap 0.1 ETH to USDC).",
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
                    text: `Swap executed! Transaction Hash: ${txHash}`,
                });
            }
            return { success: true, text: `Swap executed. Tx: ${txHash}`, data: { txHash, tokenIn, tokenOut, amount } };
        } catch (error: any) {
            elizaLogger.error("Error in SWAP_TOKENS handler:", error);
            if (callback) {
                callback({
                    text: `Failed to execute swap: ${error.message}`,
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
                    text: "Swap executed! Transaction Hash: 0x...",
                    action: "EVM_SWAP_TOKENS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Swap 1 USDC for MF-ONE" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Swap executed! Transaction Hash: 0x...",
                    action: "EVM_SWAP_TOKENS",
                },
            },
        ],
    ],
};
