import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { UniswapService } from "../services/uniswapService";

export const getQuoteAction: Action = {
    name: "GET_QUOTE",
    similes: ["QUOTE_PRICE", "CHECK_PRICE", "PRICE_CHECK"],
    description: "Get a quote for swapping tokens on Uniswap V4",
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
        elizaLogger.info("Handling GET_QUOTE action");

        const content = message.content.text || "";
        const amountMatch = content.match(/(\d+(\.\d+)?)/);
        const amount = amountMatch ? amountMatch[0] : "1";

        const words = content.split(" ");
        const symbols = words.filter(w => w === w.toUpperCase() && w.length > 1 && w.length < 6);
        const tokenIn = symbols[0] || "ETH";
        const tokenOut = symbols[1] || "USDC";

        try {
            const service = new UniswapService(runtime);
            await service.initialize(runtime);

            const quote = await service.getQuote(tokenIn, tokenOut, amount);

            if (callback) {
                callback({
                    text: `Quote: ${amount} ${tokenIn} ≈ ${quote} ${tokenOut} on Uniswap V4.`,
                });
            }
            return true;
        } catch (error: any) {
            elizaLogger.error("Error in GET_QUOTE handler:", error);
            if (callback) {
                callback({
                    text: `Failed to get quote: ${error.message}`,
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Get quote for 1 ETH to USDC" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Quote: 1 ETH ≈ 2500 USDC on Uniswap V4.",
                    action: "GET_QUOTE",
                },
            },
        ],
    ],
};
