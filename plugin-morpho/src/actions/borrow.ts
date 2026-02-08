import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger
} from "@elizaos/core";
import { MorphoService } from "../morphoService";

export const borrowAction: Action = {
    name: "BORROW_MORPHO",
    similes: ["BORROW_USDC_MORPHO", "TAKE_LOAN_MORPHO"],
    description: "Borrow USDC from Morpho Blue market against mF-ONE collateral",
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        return !!(runtime.getSetting("WALLET_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY"));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting borrowAction handler...");

        const content = message.content.text;
        if (!content) return false;

        const amountMatch = content.match(/(\d+(\.\d+)?)/);

        if (!amountMatch) {
            if (callback) {
                callback({
                    text: "I couldn't identify the amount of USDC to borrow. Please specify, e.g., 'Borrow 50 USDC'."
                });
            }
            return false;
        }

        const amount = amountMatch[0];

        try {
            const service = new MorphoService(runtime);
            await service.initialize();

            if (callback) {
                callback({
                    text: `Initiating borrow of ${amount} USDC from Morpho Blue...`
                });
            }

            const txHash = await service.borrow(amount);

            if (callback) {
                callback({
                    text: `Successfully borrowed ${amount} USDC.\nTransaction Hash: ${txHash}`
                });
            }
            return true;
        } catch (error: any) {
            elizaLogger.error("Error in borrowAction:", error);
            if (callback) {
                callback({
                    text: `Failed to borrow USDC: ${error.message}`
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Borrow 200 USDC from Morpho" }
            },
            {
                user: "{{user2}}",
                content: { text: "I'll borrow 200 USDC against your collateral on Morpho Blue." }
            }
        ]
    ] as any
};
