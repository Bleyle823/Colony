import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
} from "@elizaos/core";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { createSolanaKitAdapterFromPrivateKey } from "@circle-fin/adapter-solana-kit";
import { validateCircleConfig } from "../environment";

export const crossChainTransferAction: Action = {
    name: "CROSS_CHAIN_TRANSFER",
    similes: [
        "BRIDGE_USDC",
        "TRANSFER_CROSS_CHAIN",
        "MOVE_USDC",
        "BRIDGE_ASSETS",
    ],
    description:
        "Transfer USDC across blockchains using Circle BridgeKit (CCTP). Supports Ethereum, Solana, Arbitrum, Optimism, Base, Polygon, Avalanche.",
    validate: async (runtime: IAgentRuntime) => {
        try {
            await validateCircleConfig(runtime);
            return true;
        } catch (error) {
            return false;
        }
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        elizaLogger.log("Starting CROSS_CHAIN_TRANSFER handler...");

        try {
            const config = await validateCircleConfig(runtime);

            if (!config.EVM_PRIVATE_KEY || !config.SOLANA_PRIVATE_KEY) {
                throw new Error("EVM_PRIVATE_KEY and SOLANA_PRIVATE_KEY are required for BridgeKit");
            }

            // Extract content from the message
            // Assuming the message text is something like "Bridge 10 USDC from Ethereum to Solana"
            // Using a simple regex or just parsing for now. 
            // Ideally, we'd use an LLM provider to extract structured data, but for this plugin action, 
            // we'll try to extract simple parameters or rely on the state if it was already processed.
            
            // For robust extraction, we should use `composeContext` and `generateObject` pattern
            // But to keep it simple as per the guide, we will try to parse manually or expect parameters in the prompt.
            // Let's assume the user says "Bridge [amount] USDC from [source] to [dest]"
            
            const text = message.content.text;
            const amountMatch = text.match(/(\d+(\.\d+)?) USDC/i) || text.match(/bridge (\d+(\.\d+)?)/i);
            const fromMatch = text.match(/from (\w+)/i);
            const toMatch = text.match(/to (\w+)/i);

            if (!amountMatch || !fromMatch || !toMatch) {
                if (callback) {
                    callback({
                        text: "I couldn't understand the details. Please specify amount, source chain, and destination chain. Example: 'Bridge 10 USDC from Ethereum to Solana'",
                    });
                }
                return { success: false };
            }

            const amount = amountMatch[1];
            const sourceChain = fromMatch[1]; // e.g., "Ethereum"
            const destChain = toMatch[1];   // e.g., "Solana"

            elizaLogger.log(`Bridging ${amount} USDC from ${sourceChain} to ${destChain}`);

            // Initialize Adapters
            const evmAdapter = createViemAdapterFromPrivateKey({
                privateKey: config.EVM_PRIVATE_KEY as `0x${string}`,
            });

            const solanaAdapter = createSolanaKitAdapterFromPrivateKey({
                privateKey: config.SOLANA_PRIVATE_KEY,
            });

            const kit = new BridgeKit();

            // Map user friendly names to BridgeKit chain names if necessary
            // BridgeKit likely expects specific strings.
            // The example uses "Ethereum_Sepolia" and "Solana_Devnet". 
            // We should map "Ethereum" -> "Ethereum" or "Ethereum_Sepolia" based on env or assume production names.
            // For safety, let's try to map common names or pass through.
            
            // Simplified mapping for demo purposes
            const getAdapter = (chainName: string) => {
                if (chainName.toLowerCase().includes("solana")) return solanaAdapter;
                return evmAdapter;
            };

            const getChainName = (chainName: string) => {
                 // You might need a more robust mapping here
                 if (chainName.toLowerCase() === "ethereum") return "Ethereum";
                 if (chainName.toLowerCase() === "solana") return "Solana";
                 if (chainName.toLowerCase() === "arbitrum") return "Arbitrum";
                 if (chainName.toLowerCase() === "optimism") return "Optimism";
                 if (chainName.toLowerCase() === "base") return "Base";
                 if (chainName.toLowerCase() === "polygon") return "Polygon";
                 if (chainName.toLowerCase() === "avalanche") return "Avalanche";
                 // Fallback or testnet mappings
                 if (chainName.toLowerCase().includes("sepolia")) return "Ethereum_Sepolia";
                 if (chainName.toLowerCase().includes("devnet")) return "Solana_Devnet";
                 return chainName;
            };

            const fromAdapter = getAdapter(sourceChain);
            const toAdapter = getAdapter(destChain);

            if (callback) {
                callback({
                    text: `Initiating bridge transfer of ${amount} USDC from ${sourceChain} to ${destChain}...`,
                });
            }

            const result = await kit.bridge({
                from: { adapter: fromAdapter, chain: getChainName(sourceChain) as any },
                to: { adapter: toAdapter, chain: getChainName(destChain) as any },
                amount: amount,
            });

            elizaLogger.log("Bridge result:", result);

            if (callback) {
                callback({
                    text: `Successfully initiated bridge transfer. Transaction ID: ${result.transactionIds?.join(", ") || "N/A"}`,
                    content: {
                        success: true,
                        transactionIds: result.transactionIds,
                        amount: amount,
                        source: sourceChain,
                        destination: destChain
                    }
                });
            }

            return {
                success: true,
                content: {
                    transactionIds: result.transactionIds,
                    amount,
                    sourceChain,
                    destChain
                }
            };

        } catch (error) {
            elizaLogger.error("Error in CROSS_CHAIN_TRANSFER:", error);
            if (callback) {
                callback({
                    text: `Bridge transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
            return { success: false };
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Bridge 10 USDC from Ethereum to Solana" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Initiating bridge transfer of 10 USDC from Ethereum to Solana...",
                    action: "CROSS_CHAIN_TRANSFER",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Transfer 50 USDC from Base to Arbitrum" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Initiating bridge transfer of 50 USDC from Base to Arbitrum...",
                    action: "CROSS_CHAIN_TRANSFER",
                },
            },
        ],
    ],
};
