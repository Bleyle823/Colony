import { createPublicClient, http, createWalletClient, PublicClient, WalletClient, Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { IAgentRuntime } from "@elizaos/core";
import { arcTestnet } from "../chain";

export const getPublicClient = (): PublicClient => {
    return createPublicClient({
        chain: arcTestnet,
        transport: http(),
    });
};

export const getWalletClient = (runtime: IAgentRuntime): WalletClient | null => {
    const privateKey = runtime.getSetting("ARC_PRIVATE_KEY");
    if (!privateKey) return null;

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    return createWalletClient({
        account,
        chain: arcTestnet,
        transport: http(),
    });
};
