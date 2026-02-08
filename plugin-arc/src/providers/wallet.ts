import {
    IAgentRuntime,
    Provider,
    Memory,
    State,
} from "@elizaos/core";
import { createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../chain.js";
import { validateArcConfig } from "../environment.js";

export const walletProvider: Provider = {
    name: "arc_wallet_provider",
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ) => {
        console.log("DEBUG: Executing Arc Wallet Provider");
        try {
            const config = await validateArcConfig(runtime);
            if (!config) {
                console.log("DEBUG: Arc Config validation failed in provider");
                return { text: "" };
            }

            const account = privateKeyToAccount(config.ARC_PRIVATE_KEY.startsWith("0x") ? config.ARC_PRIVATE_KEY as `0x${string}` : `0x${config.ARC_PRIVATE_KEY}`);
            const address = account.address;

            console.log(`DEBUG: Found address ${address}`);

            const publicClient = createPublicClient({
                chain: arcTestnet,
                transport: http(config.ARC_RPC_URL)
            });

            // Add timeout to prevent hanging
            const balancePromise = publicClient.getBalance({
                address,
            });
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Balance fetch timeout')), 5000)
            );
            
            const balance = await Promise.race([balancePromise, timeoutPromise]) as bigint;

            const formattedBalance = formatEther(balance);

            return {
                text: `Arc Wallet Address: ${address}\nArc Wallet Balance: ${formattedBalance} USDC`,
                values: {
                    arc_wallet_address: address,
                    arc_wallet_balance: formattedBalance
                }
            };
        } catch (error) {
            console.error("Error in Arc wallet provider:", error);
            return { text: "" };
        }
    },
};
