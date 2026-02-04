import {
    Action,
    ActionResult,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
} from "@elizaos/core";
import { getPublicClient } from "../utils";
import { normalize, namehash } from 'viem/ens'
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const RESOLVER_ABI = [
    {
        inputs: [
            { name: "node", type: "bytes32" },
            { name: "key", type: "string" },
            { name: "value", type: "string" },
        ],
        name: "setText",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            { name: "node", type: "bytes32" },
            { name: "a", type: "address" },
        ],
        name: "setAddr",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];

const getWallet = (runtime: IAgentRuntime) => {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    if (!privateKey) return null;
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    return createWalletClient({
        account,
        chain: mainnet,
        transport: http(runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL") || "https://cloudflare-eth.com"),
    });
};

export const setEnsTextAction: Action = {
    name: "SET_ENS_TEXT",
    similes: ["UPDATE_ENS_TEXT", "SET_TEXT_RECORD", "CHANGE_ENS_KEY"],
    description: "Set a text record for an ENS name. Requires the agent to be the owner/controller.",
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("EVM_PRIVATE_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        const publicClient = getPublicClient(runtime);
        const walletClient = getWallet(runtime);
        if (!walletClient) return { success: false, text: "Private key not configured" };

        const text = message.content.text;
        const nameMatch = text.match(/([a-zA-Z0-9-]+\.eth)/i);
        const keyMatch = text.match(/set (\w+)/i);
        const valueMatch = text.match(/to (.+)$/i);

        if (!nameMatch || !keyMatch || !valueMatch) {
             if (callback) callback({ text: "Please specify: Set [key] for [name] to [value]" });
             return { success: false };
        }
        
        const ensName = nameMatch[0];
        let key = keyMatch[1].toLowerCase();
        if (key === "twitter") key = "com.twitter";
        if (key === "github") key = "com.github";
        
        const value = valueMatch[1].trim();

        try {
            const resolverAddress = await publicClient.getEnsResolver({ name: normalize(ensName) });
            if (!resolverAddress) {
                if (callback) callback({ text: `No resolver found for ${ensName}` });
                return { success: false };
            }

            const hash = await walletClient.writeContract({
                address: resolverAddress,
                abi: RESOLVER_ABI,
                functionName: 'setText',
                args: [namehash(normalize(ensName)), key, value],
            });

            if (callback) {
                callback({
                    text: `Transaction sent to set ${key} for ${ensName}. Hash: ${hash}`,
                    content: { txHash: hash, ensName, key, value }
                });
            }
            return { success: true, content: { txHash: hash } };
        } catch (error) {
             elizaLogger.error("Error setting ENS text:", error);
             if (callback) callback({ text: `Failed to set record: ${error.message}` });
             return { success: false };
        }
    },
    examples: [
        [
             { user: "{{user1}}", content: { text: "Set email for myname.eth to me@example.com" } },
             { user: "{{agentName}}", content: { text: "Transaction sent..." } }
        ]
    ]
};

export const setEnsAddressAction: Action = {
    name: "SET_ENS_ADDRESS",
    similes: ["SET_ENS_ADDR", "POINT_ENS_TO_ADDRESS", "UPDATE_ENS_ADDRESS"],
    description: "Set the Ethereum address (ETH record) for an ENS name.",
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("EVM_PRIVATE_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        const publicClient = getPublicClient(runtime);
        const walletClient = getWallet(runtime);
        if (!walletClient) return { success: false, text: "Private key not configured" };

        const text = message.content.text;
        const nameMatch = text.match(/([a-zA-Z0-9-]+\.eth)/i);
        const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/i);

        if (!nameMatch || !addressMatch) {
             if (callback) callback({ text: "Please specify: Set address for [name] to [0xAddress]" });
             return { success: false };
        }
        
        const ensName = nameMatch[0];
        const address = addressMatch[0];

        try {
            const resolverAddress = await publicClient.getEnsResolver({ name: normalize(ensName) });
            if (!resolverAddress) {
                if (callback) callback({ text: `No resolver found for ${ensName}` });
                return { success: false };
            }

            const hash = await walletClient.writeContract({
                address: resolverAddress,
                abi: RESOLVER_ABI,
                functionName: 'setAddr',
                args: [namehash(normalize(ensName)), address],
            });

            if (callback) {
                callback({
                    text: `Transaction sent to set address for ${ensName} to ${address}. Hash: ${hash}`,
                    content: { txHash: hash, ensName, address }
                });
            }
            return { success: true, content: { txHash: hash } };
        } catch (error) {
             elizaLogger.error("Error setting ENS address:", error);
             if (callback) callback({ text: `Failed to set address: ${error.message}` });
             return { success: false };
        }
    },
    examples: [
        [
             { user: "{{user1}}", content: { text: "Set address for myname.eth to 0x123..." } },
             { user: "{{agentName}}", content: { text: "Transaction sent..." } }
        ]
    ]
};

export const setEnsAvatarAction: Action = {
    name: "SET_ENS_AVATAR",
    similes: ["UPDATE_ENS_AVATAR", "CHANGE_PROFILE_PIC", "SET_AVATAR"],
    description: "Set the avatar for an ENS name.",
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("EVM_PRIVATE_KEY");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        const publicClient = getPublicClient(runtime);
        const walletClient = getWallet(runtime);
        if (!walletClient) return { success: false, text: "Private key not configured" };

        const text = message.content.text;
        const nameMatch = text.match(/([a-zA-Z0-9-]+\.eth)/i);
        const urlMatch = text.match(/to (https?:\/\/[^\s]+|ipfs:\/\/[^\s]+)/i);

        if (!nameMatch || !urlMatch) {
             if (callback) callback({ text: "Please specify: Set avatar for [name] to [url]" });
             return { success: false };
        }
        
        const ensName = nameMatch[0];
        const avatarUrl = urlMatch[1];

        try {
            const resolverAddress = await publicClient.getEnsResolver({ name: normalize(ensName) });
            if (!resolverAddress) {
                if (callback) callback({ text: `No resolver found for ${ensName}` });
                return { success: false };
            }

            const hash = await walletClient.writeContract({
                address: resolverAddress,
                abi: RESOLVER_ABI,
                functionName: 'setText',
                args: [namehash(normalize(ensName)), 'avatar', avatarUrl],
            });

            if (callback) {
                callback({
                    text: `Transaction sent to set avatar for ${ensName}. Hash: ${hash}`,
                    content: { txHash: hash, ensName, avatarUrl }
                });
            }
            return { success: true, content: { txHash: hash } };
        } catch (error) {
             elizaLogger.error("Error setting ENS avatar:", error);
             if (callback) callback({ text: `Failed to set avatar: ${error.message}` });
             return { success: false };
        }
    },
    examples: [
        [
             { user: "{{user1}}", content: { text: "Set avatar for myname.eth to https://example.com/pic.jpg" } },
             { user: "{{agentName}}", content: { text: "Transaction sent..." } }
        ]
    ]
};
