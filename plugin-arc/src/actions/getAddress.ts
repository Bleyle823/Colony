import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    logger,
} from "@elizaos/core";
import { privateKeyToAccount } from "viem/accounts";
import { validateArcConfig } from "../environment.js";

export const getAddressAction: Action = {
    name: "GET_ARC_ADDRESS",
    similes: [
        "MY_ADDRESS",
        "ARC_WALLET",
        "GET_WALLET_ADDRESS",
        "SHOW_ADDRESS",
        "WHATS_MY_ADDRESS",
        "WALLET_ADDRESS"
    ],
    description: "Get the agent's wallet address on the Arc Testnet.",
    validate: async (runtime: IAgentRuntime) => {
        const config = await validateArcConfig(runtime);
        return !!config;
    },
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state: State | undefined,
        _options: any,
        callback?: HandlerCallback
    ): Promise<ActionResult> => {
        logger.log("Starting GET_ARC_ADDRESS handler...");

        try {
            const config = await validateArcConfig(runtime);
            if (!config) throw new Error("Invalid Arc configuration");

            const account = privateKeyToAccount(config.ARC_PRIVATE_KEY.startsWith("0x") ? config.ARC_PRIVATE_KEY as `0x${string}` : `0x${config.ARC_PRIVATE_KEY}`);
            const address = account.address;

            logger.log(`Agent Arc Address: ${address}`);

            if (callback) {
                callback({
                    text: `My wallet address on Arc Testnet is: ${address}`,
                    content: {
                        success: true,
                        address: address
                    }
                });
            }

            return {
                success: true,
                text: `My wallet address on Arc Testnet is: ${address}`,
                data: {
                    address: address
                }
            };

        } catch (error) {
            logger.error("Error in GET_ARC_ADDRESS:", error instanceof Error ? error.message : String(error));
            if (callback) {
                callback({
                    text: `Failed to retrieve address: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    },
    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "What is your wallet address?" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "My wallet address on Arc Testnet is: 0x1234567890123456789012345678901234567890",
                    action: "GET_ARC_ADDRESS",
                },
            },
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Show me your address" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "My wallet address on Arc Testnet is: 0x1234567890123456789012345678901234567890",
                    action: "GET_ARC_ADDRESS",
                },
            },
        ]
    ],
};
