import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    logger,
} from "@elizaos/core";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { createSolanaKitAdapterFromPrivateKey } from "@circle-fin/adapter-solana-kit";
import { validateArcConfig } from "../environment.js";

// Mapping of user-friendly names to BridgeKit chain IDs
const CHAIN_MAPPING: Record<string, string> = {
    "base": "Base_Sepolia",
    "base sepolia": "Base_Sepolia",
    "ethereum": "Ethereum_Sepolia",
    "ethereum sepolia": "Ethereum_Sepolia",
    "sepolia": "Ethereum_Sepolia",
    "arbitrum": "Arbitrum_Sepolia",
    "arbitrum sepolia": "Arbitrum_Sepolia",
    "optimism": "OP_Sepolia",
    "op sepolia": "OP_Sepolia",
    "polygon": "Polygon_PoS_Amoy",
    "polygon amoy": "Polygon_PoS_Amoy",
    "avalanche": "Avalanche_Fuji",
    "avalanche fuji": "Avalanche_Fuji",
    "arc": "Arc_Testnet",
    "arc testnet": "Arc_Testnet",
    "solana": "Solana_Devnet",
    "solana devnet": "Solana_Devnet"
};

export const bridgeAction: Action = {
    name: "BRIDGE_USDC_FROM_ARC",
    similes: [
        "BRIDGE_USDC",
        "BRIDGE_TO_BASE",
        "BRIDGE_TO_ETHEREUM",
        "BRIDGE_TO_SOLANA",
        "CROSS_CHAIN_TRANSFER_FROM_ARC",
        "SEND_USDC_CROSS_CHAIN"
    ],
    description: "Bridge USDC from Arc Testnet to other supported chains (Base Sepolia, Ethereum Sepolia, Solana Devnet, etc.) using Circle BridgeKit.",
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
        logger.log("Starting BRIDGE_USDC_FROM_ARC handler...");

        try {
            const config = await validateArcConfig(runtime);
            if (!config) throw new Error("Invalid Arc configuration");

            const text = message.content.text;
            if (!text) return { success: false, error: "No text in message" };

            // Parse amount and destination
            const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|tokens?)/i) || text.match(/bridge (\d+(\.\d+)?)/i);
            const toMatch = text.match(/to ([\w\s]+)/i);

            if (!amountMatch || !toMatch) {
                if (callback) {
                    callback({
                        text: "Please specify the amount and the destination chain. Example: 'Bridge 10 USDC to Base Sepolia'",
                    });
                }
                return { success: false };
            }

            const amount = amountMatch[1];
            const rawDest = toMatch[1].trim().toLowerCase();
            
            // Resolve destination chain
            let destChain = CHAIN_MAPPING[rawDest];
            
            // Fallback: try to match partial names if not found
            if (!destChain) {
                 const keys = Object.keys(CHAIN_MAPPING);
                 const found = keys.find(k => rawDest.includes(k));
                 if (found) destChain = CHAIN_MAPPING[found];
            }

            if (!destChain) {
                 if (callback) {
                    callback({
                        text: `Unsupported or unknown destination chain: ${rawDest}. Supported: Base, Ethereum, Solana, Arbitrum, Optimism, Polygon, Avalanche (Testnets).`,
                    });
                }
                return { success: false };
            }

            logger.log(`Bridging ${amount} USDC from Arc_Testnet to ${destChain}`);

            if (callback) {
                callback({
                    text: `Initiating bridge of ${amount} USDC from Arc Testnet to ${destChain}...`,
                });
            }

            // Initialize Source Adapter (EVM - Arc)
            const privateKey = config.ARC_PRIVATE_KEY.startsWith("0x") 
                ? config.ARC_PRIVATE_KEY as `0x${string}` 
                : `0x${config.ARC_PRIVATE_KEY}`;

            const sourceAdapter = createViemAdapterFromPrivateKey({
                privateKey: privateKey as `0x${string}`,
            });

            // Initialize Destination Adapter
            let destAdapter;
            
            if (destChain.includes("Solana")) {
                if (!config.SOLANA_PRIVATE_KEY) {
                     const errorMsg = "Bridging to Solana requires SOLANA_PRIVATE_KEY in the agent settings.";
                     if (callback) callback({ text: errorMsg });
                     return { success: false, error: errorMsg };
                }
                destAdapter = createSolanaKitAdapterFromPrivateKey({
                    privateKey: config.SOLANA_PRIVATE_KEY,
                });
            } else {
                // EVM Destination - Reuse Arc Private Key (assumes same wallet for all EVM testnets)
                destAdapter = sourceAdapter;
            }

            const kit = new BridgeKit();

            const result = await kit.bridge({
                from: { adapter: sourceAdapter, chain: "Arc_Testnet" },
                to: { adapter: destAdapter, chain: destChain as any },
                amount: amount,
            });

            logger.log("Bridge result:", JSON.stringify(result, null, 2));

            // Format output
            const steps = result.steps || [];
            const lastStep = steps[steps.length - 1];
            const txHash = lastStep?.txHash;
            const explorerUrl = (lastStep?.data as any)?.explorerUrl;

            let responseText = `Successfully initiated bridge of ${amount} USDC to ${destChain}.`;
            if (explorerUrl) {
                responseText += `\nTrack transaction: ${explorerUrl}`;
            } else if (txHash) {
                responseText += `\nTransaction Hash: ${txHash}`;
            }

            if (callback) {
                callback({
                    text: responseText,
                    content: {
                        success: true,
                        amount,
                        source: "Arc_Testnet",
                        destination: destChain,
                        result
                    }
                });
            }

            return {
                success: true,
                text: responseText,
                data: {
                    amount,
                    source: "Arc_Testnet",
                    destination: destChain,
                    result
                }
            };

        } catch (error) {
            logger.error("Error in BRIDGE_USDC_FROM_ARC:", error instanceof Error ? error.message : String(error));
            if (callback) {
                callback({
                    text: `Bridge failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    },
    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "Bridge 10 USDC to Base Sepolia" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Successfully initiated bridge of 10 USDC to Base_Sepolia...",
                    action: "BRIDGE_USDC_FROM_ARC",
                },
            },
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Bridge 5 USDC to Solana" },
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Successfully initiated bridge of 5 USDC to Solana_Devnet...",
                    action: "BRIDGE_USDC_FROM_ARC",
                },
            },
        ]
    ],
};
