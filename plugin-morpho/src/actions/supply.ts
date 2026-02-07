import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger
} from "@elizaos/core";
import { MorphoService } from "../morphoService";

export const supplyCollateralAction: Action = {
    name: "SUPPLY_COLLATERAL_MORPHO",
    similes: ["SUPPLY_MORPHO", "DEPOSIT_MORPHO_COLLATERAL", "ADD_COLLATERAL_MORPHO", "SUPPLY_COLLATERAL", "DEPOSIT_COLLATERAL", "SUPPLY_TOKENS_MORPHO"],
    description: "Supply mF-ONE collateral to Morpho Blue market",
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
        elizaLogger.log("Starting supplyCollateralAction handler...");

        const content = message.content.text;
        if (!content) return false;

        const amountMatch = content.match(/(\d+(\.\d+)?)/);

        if (!amountMatch) {
            if (callback) {
                callback({
                    text: "I couldn't identify the amount of mF-ONE to supply. Please specify explicitly, e.g., 'Supply 10 mF-ONE'."
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
                    text: `Initiating supply of ${amount} mF-ONE to Morpho Blue...`
                });
            }

            const txHash = await service.supplyCollateral(amount);

            if (callback) {
                callback({
                    text: `Successfully supplied ${amount} mF-ONE to Morpho Blue.\nTransaction Hash: ${txHash}`
                });
            }
            return true;
        } catch (error: any) {
            elizaLogger.error("Error in supplyCollateralAction:", error);
            if (callback) {
                callback({
                    text: `Failed to supply collateral: ${error.message}`
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Supply 100 mF-ONE to Morpho" }
            },
            {
                user: "{{user2}}",
                content: { text: "I'll supply 100 mF-ONE as collateral to the Morpho Blue market for you." }
            }
        ]
    ] as any
};
