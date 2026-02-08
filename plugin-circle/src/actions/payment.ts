import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
} from "@elizaos/core";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { validateCircleConfig } from "../environment";

export const sendUsdcAction: Action = {
    name: "SEND_USDC",
    similes: [
        "PAY_USDC",
        "TRANSFER_USDC",
        "SEND_PAYMENT",
        "MAKE_PAYMENT",
    ],
    description:
        "Send USDC payment using Circle Developer-Controlled Wallets. Automatically selects a wallet with sufficient balance.",
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
        elizaLogger.log("Starting SEND_USDC handler...");

        try {
            const config = await validateCircleConfig(runtime);

            const client = initiateDeveloperControlledWalletsClient({
                apiKey: config.CIRCLE_API_KEY,
                entitySecret: config.CIRCLE_ENTITY_SECRET,
            });

            // Parse request
            const text = message.content.text;
            const amountMatch = text.match(/(\d+(\.\d+)?) USDC/i) || text.match(/send (\d+(\.\d+)?)/i);
            const toMatch = text.match(/to (\w+)/i) || text.match(/address (\w+)/i); // Simple address matching
            // Chain might be optional or inferred, but let's look for it
            const chainMatch = text.match(/on (\w+)/i);

            if (!amountMatch || !toMatch) {
                if (callback) {
                    callback({
                        text: "Please specify the amount and destination address. Example: 'Send 10 USDC to 0x123... on ETH'",
                    });
                }
                return { success: false };
            }

            const amount = amountMatch[1];
            const destinationAddress = toMatch[1];
            const chain = chainMatch ? chainMatch[1].toUpperCase() : "ETH"; // Default to ETH if not specified? Or require it.

            // 1. Find a wallet with sufficient balance
            // We need to map friendly chain names to Circle blockchain enums if needed
            // e.g. "ETH" -> "ETH-SEPOLIA" or similar depending on env. 
            // For now, let's assume the user passes a valid Circle blockchain code or we map common ones.
            let blockchain = chain;
            if (chain === "ETHEREUM") blockchain = "ETH";
            if (chain === "SOLANA") blockchain = "SOL";
            if (chain === "POLYGON") blockchain = "MATIC";
            
            // NOTE: You might want to use a testnet by default for safety in dev
            // blockchain = "ETH-SEPOLIA"; 

            if (callback) {
                callback({
                    text: `Checking wallets for ${amount} USDC on ${blockchain}...`,
                });
            }

            // Get wallets with balances
            const walletsResponse = await client.getWalletsWithBalances({
                blockchain: blockchain,
                tokenAddress: undefined, // Monitor all or specific? 
                // We might need to know the USDC token address for the chain, or filter by symbol in the response
            });

            // This part depends on the exact SDK response structure
            const wallets = walletsResponse.data?.wallets || [];
            let selectedWalletId: string | null = null;
            let tokenId: string | null = null;

            for (const wallet of wallets) {
                const balances = (wallet as any).tokenBalances || [];
                const usdcBalance = balances.find((b: any) => b.token?.symbol === "USDC");
                
                if (usdcBalance && parseFloat(usdcBalance.amount) >= parseFloat(amount)) {
                    selectedWalletId = wallet.id;
                    tokenId = usdcBalance.token.id;
                    break;
                }
            }

            if (!selectedWalletId || !tokenId) {
                if (callback) {
                    callback({
                        text: `No wallet found with sufficient USDC balance on ${blockchain}.`,
                    });
                }
                return { success: false };
            }

            if (callback) {
                callback({
                    text: `Found wallet ${selectedWalletId}. Sending ${amount} USDC...`,
                });
            }

            // 2. Create Transaction
            const transactionResponse = await client.createTransaction({
                walletId: selectedWalletId,
                tokenId: tokenId,
                destinationAddress: destinationAddress,
                amounts: [amount],
                fee: {
                    type: "level",
                    config: {
                        feeLevel: "MEDIUM"
                    }
                }
            });

            elizaLogger.log("Transaction created:", transactionResponse);

            if (callback) {
                callback({
                    text: `Transaction initiated! ID: ${transactionResponse.data?.id}`,
                    content: {
                        success: true,
                        transactionId: transactionResponse.data?.id,
                        amount: amount,
                        destination: destinationAddress,
                        walletId: selectedWalletId
                    }
                });
            }

            return {
                success: true,
                content: {
                    transactionId: transactionResponse.data?.id
                }
            };

        } catch (error) {
            elizaLogger.error("Error in SEND_USDC:", error);
            if (callback) {
                callback({
                    text: `Payment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                });
            }
            return { success: false };
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Send 5 USDC to 0x123abc... on ETH" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Checking wallets for 5 USDC on ETH...",
                    action: "SEND_USDC",
                },
            },
        ],
    ],
};
