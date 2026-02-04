import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
} from "@elizaos/core";
import { getPublicClient, getWalletClient } from "../utils";
import { formatEther, parseEther, isAddress } from "viem";

export const getBalanceAction: Action = {
    name: "GET_ARC_BALANCE",
    similes: ["CHECK_ARC_BALANCE", "ARC_BALANCE", "MY_ARC_BALANCE"],
    description: "Check the USDC balance (native gas token) on Arc Testnet.",
    validate: async (runtime: IAgentRuntime) => {
        return true; 
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        elizaLogger.log("Starting GET_ARC_BALANCE handler...");
        const publicClient = getPublicClient();
        const walletClient = getWalletClient(runtime);
        
        let targetAddress: `0x${string}` | undefined;

        // Try to find an address in the message
        const text = message.content.text;
        const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
        
        if (addressMatch) {
            targetAddress = addressMatch[0] as `0x${string}`;
        } else if (walletClient && walletClient.account) {
            targetAddress = walletClient.account.address;
        } else {
             if (callback) callback({ text: "I need an address to check the balance, or configure ARC_PRIVATE_KEY." });
             return { success: false };
        }

        try {
            const balance = await publicClient.getBalance({
                address: targetAddress,
            });

            const balanceFormatted = formatEther(balance);

            if (callback) {
                callback({
                    text: `Balance for ${targetAddress}: ${balanceFormatted} USDC (Native)`,
                    content: { address: targetAddress, balance: balanceFormatted, symbol: "USDC" }
                });
            }
            return { success: true, content: { address: targetAddress, balance: balanceFormatted } };
        } catch (error) {
            elizaLogger.error("Error fetching balance:", error);
            if (callback) callback({ text: `Error fetching balance: ${error.message}` });
            return { success: false };
        }
    },
    examples: [
        [
            { user: "{{user1}}", content: { text: "Check my Arc balance" } },
            { user: "{{agentName}}", content: { text: "Balance for 0x...: 10.5 USDC" } }
        ]
    ]
};

export const sendTokenAction: Action = {
    name: "SEND_ARC_TOKEN",
    similes: ["TRANSFER_ARC_TOKEN", "SEND_ARC_USDC", "PAY_ON_ARC"],
    description: "Send USDC (native token) on Arc Testnet.",
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("ARC_PRIVATE_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        const walletClient = getWalletClient(runtime);
        if (!walletClient) return { success: false, text: "Private key not configured" };

        const text = message.content.text;
        const amountMatch = text.match(/(\d+(\.\d+)?)/);
        const toMatch = text.match(/(0x[a-fA-F0-9]{40})/);

        if (!amountMatch || !toMatch) {
             if (callback) callback({ text: "Please specify amount and destination address. Example: 'Send 1 USDC to 0x123...'" });
             return { success: false };
        }

        const amount = amountMatch[0];
        const to = toMatch[0] as `0x${string}`;

        try {
            const hash = await walletClient.sendTransaction({
                to,
                value: parseEther(amount),
            });

            if (callback) {
                callback({
                    text: `Transaction sent! Hash: ${hash}`,
                    content: { txHash: hash, amount, to }
                });
            }
            return { success: true, content: { txHash: hash } };
        } catch (error) {
             elizaLogger.error("Error sending transaction:", error);
             if (callback) callback({ text: `Transaction failed: ${error.message}` });
             return { success: false };
        }
    },
    examples: [
        [
             { user: "{{user1}}", content: { text: "Send 5 USDC to 0x123..." } },
             { user: "{{agentName}}", content: { text: "Transaction sent! Hash: 0x..." } }
        ]
    ]
};
