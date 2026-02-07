import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger
} from "@elizaos/core";
import { MorphoService } from "../morphoService";

export const repayAction: Action = {
    name: "REPAY_MORPHO",
    similes: ["REPAY_LOAN_MORPHO", "PAY_BACK_MORPHO"],
    description: "Repay USDC loan on Morpho Blue market",
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
        elizaLogger.log("Starting repayAction handler...");

        const content = message.content.text;
        if (!content) return false;

        // Check for "all" or specific amount
        const isAll = content.toLowerCase().includes("all") || content.toLowerCase().includes("full");
        const amountMatch = content.match(/(\d+(\.\d+)?)/);

        let amount = "";
        if (isAll) {
            amount = "all";
        } else if (amountMatch) {
            amount = amountMatch[0];
        } else {
            if (callback) {
                callback({
                    text: "I couldn't identify the amount to repay. Please specify 'all' or an amount, e.g., 'Repay 50 USDC'."
                });
            }
            return false;
        }

        try {
            const service = new MorphoService(runtime);
            await service.initialize();

            if (callback) {
                callback({
                    text: `Initiating repayment of ${amount === "all" ? "full loan" : amount + " USDC"} to Morpho Blue...`
                });
            }

            const txHash = await service.repay(amount);

            if (callback) {
                callback({
                    text: `Successfully repaid ${amount === "all" ? "loan" : amount + " USDC"}.\nTransaction Hash: ${txHash}`
                });
            }
            return true;
        } catch (error: any) {
            elizaLogger.error("Error in repayAction:", error);
            if (callback) {
                callback({
                    text: `Failed to repay loan: ${error.message}`
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Repay all my debt on Morpho" }
            },
            {
                user: "{{user2}}",
                content: { text: "I'll repay your full USDC debt on Morpho Blue." }
            }
        ]
    ] as any
};
