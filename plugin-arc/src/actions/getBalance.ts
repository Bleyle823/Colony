import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    logger,
} from "@elizaos/core";
import { createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../chain.js";
import { validateArcConfig } from "../environment.js";

export const getBalanceAction: Action = {
    name: "GET_ARC_BALANCE",
    similes: [
        "CHECK_BALANCE",
        "MY_BALANCE",
        "WALLET_BALANCE",
        "SHOW_BALANCE",
        "ACCOUNT_BALANCE"
    ],
    description: "Check the USDC balance of the agent's EVM wallet on the Arc Testnet. Use this when the user asks about funds, balance, or money.",
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
        logger.log("Starting GET_ARC_BALANCE handler...");

        try {
            const config = await validateArcConfig(runtime);
            if (!config) throw new Error("Invalid Arc configuration");

            const account = privateKeyToAccount(config.ARC_PRIVATE_KEY.startsWith("0x") ? config.ARC_PRIVATE_KEY as `0x${string}` : `0x${config.ARC_PRIVATE_KEY}`);
            const address = account.address;

            const publicClient = createPublicClient({
                chain: arcTestnet,
                transport: http(config.ARC_RPC_URL)
            });

            const balance = await publicClient.getBalance({
                address: address
            });

            const balanceFormatted = formatEther(balance);

            logger.log(`Agent Arc Balance: ${balanceFormatted} USDC`);

            if (callback) {
                callback({
                    text: `My balance on Arc Testnet is: ${balanceFormatted} USDC`,
                    content: {
                        success: true,
                        balance: balanceFormatted,
                        symbol: "USDC",
                        address: address
                    }
                });
            }

            return {
                success: true,
                text: `My balance on Arc Testnet is: ${balanceFormatted} USDC`,
                data: {
                    balance: balanceFormatted,
                    symbol: "USDC",
                    address: address
                }
            };

        } catch (error) {
            logger.error("Error in GET_ARC_BALANCE:", error instanceof Error ? error.message : String(error));
            if (callback) {
                callback({
                    text: `Failed to retrieve balance: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    },
    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "What is your balance?" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "My balance on Arc Testnet is: 100.50 USDC",
                    action: "GET_ARC_BALANCE",
                },
            },
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Check your wallet funds" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "My balance on Arc Testnet is: 100.50 USDC",
                    action: "GET_ARC_BALANCE",
                },
            },
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Do you have any money?" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Let me check my wallet. My balance is 50 USDC.",
                    action: "GET_ARC_BALANCE",
                },
            },
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "How much USDC do you have?" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "I have 250 USDC on Arc Testnet.",
                    action: "GET_ARC_BALANCE",
                },
            },
        ]
    ],
};
