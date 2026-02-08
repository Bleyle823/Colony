import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    logger,
} from "@elizaos/core";
import { createWalletClient, http, parseEther, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../chain.js";
import { validateArcConfig } from "../environment.js";

export const transferAction: Action = {
    name: "SEND_USDC_ON_ARC",
    similes: [
        "SEND_USDC",
        "TRANSFER_USDC",
        "PAY_USDC",
        "SEND_TOKENS_ON_ARC",
    ],
    description: "Send USDC to an address on the Arc Testnet.",
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
        logger.log("Starting SEND_USDC_ON_ARC handler...");

        try {
            const config = await validateArcConfig(runtime);
            if (!config) throw new Error("Invalid Arc configuration");

            const text = message.content.text;
            if (!text) return { success: false, error: "No text in message" };

            const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|tokens?)/i) || text.match(/send (\d+(\.\d+)?)/i);
            const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);

            if (!amountMatch || !addressMatch) {
                if (callback) {
                    callback({
                        text: "Please specify the amount and the recipient address (0x...). Example: 'Send 10 USDC to 0x123...'",
                    });
                }
                return { success: false };
            }

            const amount = amountMatch[1];
            const to = addressMatch[1] as `0x${string}`;

            if (!isAddress(to)) {
                 if (callback) {
                    callback({
                        text: "Invalid recipient address.",
                    });
                }
                return { success: false };
            }

            logger.log(`Sending ${amount} USDC to ${to} on Arc Testnet`);

            const account = privateKeyToAccount(config.ARC_PRIVATE_KEY.startsWith("0x") ? config.ARC_PRIVATE_KEY as `0x${string}` : `0x${config.ARC_PRIVATE_KEY}`);
            
            const client = createWalletClient({
                account,
                chain: arcTestnet,
                transport: http(config.ARC_RPC_URL)
            });

            const hash = await client.sendTransaction({
                to,
                value: parseEther(amount), // USDC has 18 decimals on Arc, same as Ether
                chain: arcTestnet
            });

            logger.log(`Transaction sent: ${hash}`);

            if (callback) {
                callback({
                    text: `Successfully sent ${amount} USDC to ${to}. Transaction Hash: ${hash}\nExplorer: ${arcTestnet.blockExplorers?.default.url}/tx/${hash}`,
                    content: {
                        success: true,
                        hash,
                        amount,
                        to,
                        explorerLink: `${arcTestnet.blockExplorers?.default.url}/tx/${hash}`
                    }
                });
            }

            return {
                success: true,
                text: `Successfully sent ${amount} USDC to ${to}. Transaction Hash: ${hash}`,
                data: {
                    hash,
                    amount,
                    to
                }
            };

        } catch (error) {
            logger.error("Error in SEND_USDC_ON_ARC:", error instanceof Error ? error.message : String(error));
            if (callback) {
                callback({
                    text: `Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    },
    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "Send 10 USDC to 0x1234567890123456789012345678901234567890" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Successfully sent 10 USDC to 0x1234567890123456789012345678901234567890...",
                    action: "SEND_USDC_ON_ARC",
                },
            },
        ]
    ],
};
