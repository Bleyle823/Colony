import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { UniswapService } from "../services/uniswapService";

export const swapTokensAction: Action = {
    name: "SWAP_TOKENS",
    similes: ["SWAP", "TRADE", "EXCHANGE"],
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

        const words = content.split(" ");
        const symbols = words.filter(w => w === w.toUpperCase() && w.length > 1 && w.length < 6);
        const tokenIn = symbols[0] || "ETH";
        const tokenOut = symbols[1] || "USDC";

        try {
            const service = new UniswapService(runtime);
            await service.initialize(runtime);

            const txHash = await service.executeSwap(tokenIn, tokenOut, amount);

            if (callback) {
                callback({
                    text: `Swap executed! Transaction Hash: ${txHash}`,
                });
            }
            return true;
        } catch (error: any) {
            elizaLogger.error("Error in SWAP_TOKENS handler:", error);
            if (callback) {
                callback({
                    text: `Failed to execute swap: ${error.message}`,
                });
            }
            return false;
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
                    action: "SWAP_TOKENS",
                },
            },
        ],
    ],
};
