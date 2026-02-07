import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger
} from "@elizaos/core";
import { MorphoService } from "../morphoService";

export const withdrawCollateralAction: Action = {
    name: "WITHDRAW_COLLATERAL_MORPHO",
    similes: ["WITHDRAW_MORPHO", "REMOVE_COLLATERAL_MORPHO"],
    description: "Withdraw mF-ONE collateral from Morpho Blue market",
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
        elizaLogger.log("Starting withdrawCollateralAction handler...");

        const content = message.content.text;
        if (!content) return false;

        const amountMatch = content.match(/(\d+(\.\d+)?)/);

        if (!amountMatch) {
            if (callback) {
                callback({
                    text: "I couldn't identify the amount of mF-ONE to withdraw. Please specify, e.g., 'Withdraw 10 mF-ONE'."
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
                    text: `Initiating withdrawal of ${amount} mF-ONE from Morpho Blue...`
                });
            }

            const txHash = await service.withdrawCollateral(amount);

            if (callback) {
                callback({
                    text: `Successfully withdrawn ${amount} mF-ONE.\nTransaction Hash: ${txHash}`
                });
            }
            return true;
        } catch (error: any) {
            elizaLogger.error("Error in withdrawCollateralAction:", error);
            if (callback) {
                callback({
                    text: `Failed to withdraw collateral: ${error.message}`
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Withdraw 50 mF-ONE from Morpho" }
            },
            {
                user: "{{user2}}",
                content: { text: "I'll withdraw 50 mF-ONE collateral from Morpho Blue for you." }
            }
        ]
    ] as any
};
