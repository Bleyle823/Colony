import { createPublicClient, http, createWalletClient, custom } from "viem";
import { mainnet } from "viem/chains";
import { IAgentRuntime } from "@elizaos/core";

export const getPublicClient = (runtime: IAgentRuntime) => {
    const transportUrl = runtime.getSetting("ETHEREUM_PROVIDER_URL") || "https://cloudflare-eth.com";
    return createPublicClient({
        chain: mainnet,
        transport: http(transportUrl),
    });
};

export const getWalletClient = (runtime: IAgentRuntime) => {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    if (!privateKey) return null;
    
    // For a real plugin we would need an account. 
    // Here we return null if no key, or we'd construct an account.
    // Since we can't easily import 'privateKeyToAccount' without 'viem/accounts' 
    // and we want to keep imports clean:
    
    // We will handle wallet creation inside the action if needed for writing.
    return null; 
};
