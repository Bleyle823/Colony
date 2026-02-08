import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    logger,
} from "@elizaos/core";
import { createPublicClient, http, formatEther, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../chain.js";
import { validateArcConfig } from "../environment.js";

export const getBalanceAction: Action = {
    name: "GET_BALANCE_ON_ARC",
    similes: [
        "CHECK_ARC_BALANCE",
        "ARC_BALANCE",
        "MY_ARC_BALANCE",
        "CHECK_BALANCE",
    ],
    description: "Get the USDC balance on Arc Testnet for the agent or a specific address.",
    validate: async (runtime: IAgentRuntime) => {
        const config = await validateArcConfig(runtime);
        return !!config;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        _options: any,
        callback?: HandlerCallback
    ): Promise<ActionResult> => {
        logger.log("Starting GET_BALANCE_ON_ARC handler...");

        try {
            const config = await validateArcConfig(runtime);
            if (!config) throw new Error("Invalid Arc configuration");

            const text = message.content.text;
            let targetAddress: `0x${string}`;

            // Check for explicit address in message
            const addressMatch = text?.match(/(0x[a-fA-F0-9]{40})/);
            if (addressMatch) {
                targetAddress = addressMatch[1] as `0x${string}`;
            } else {
                // Default to agent's address
                const account = privateKeyToAccount(config.ARC_PRIVATE_KEY.startsWith("0x") ? config.ARC_PRIVATE_KEY as `0x${string}` : `0x${config.ARC_PRIVATE_KEY}`);
                targetAddress = account.address;
            }

            if (!isAddress(targetAddress)) {
                if (callback) {
                    callback({
                        text: "Invalid address provided.",
                    });
                }
                return { success: false };
            }

            const publicClient = createPublicClient({
                chain: arcTestnet,
                transport: http(config.ARC_RPC_URL)
            });

            const balance = await publicClient.getBalance({
                address: targetAddress,
            });

            const formattedBalance = formatEther(balance);
            logger.log(`Balance for ${targetAddress}: ${formattedBalance} USDC`);

            if (callback) {
                callback({
                    text: `Balance for ${targetAddress} on Arc Testnet is ${formattedBalance} USDC.`,
                    content: {
                        success: true,
                        address: targetAddress,
                        balance: formattedBalance,
                        rawBalance: balance.toString()
                    }
                });
            }

            return {
                success: true,
                text: `Balance for ${targetAddress}: ${formattedBalance} USDC`,
                data: {
                    address: targetAddress,
                    balance: formattedBalance
                }
            };

        } catch (error) {
            logger.error("Error in GET_BALANCE_ON_ARC:", error instanceof Error ? error.message : String(error));
            if (callback) {
                callback({
                    text: `Failed to fetch balance: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    },
    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "What is my balance on Arc?" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Balance for 0x... is 100.5 USDC.",
                    action: "GET_BALANCE_ON_ARC",
                },
            },
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Check balance of 0x1234567890123456789012345678901234567890 on Arc" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Balance for 0x1234... is 50.0 USDC.",
                    action: "GET_BALANCE_ON_ARC",
                },
            },
        ]
    ],
};
