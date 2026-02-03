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
import { normalize } from 'viem/ens'
import { isAddress } from "viem";

export const resolveEnsAction: Action = {
    name: "RESOLVE_ENS",
    similes: ["RESOLVE_NAME", "GET_ENS_ADDRESS", "WHOIS_ENS", "LOOKUP_ENS"],
    description: "Resolve an ENS name to an Ethereum address.",
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("ETHEREUM_PROVIDER_URL");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        elizaLogger.log("Starting RESOLVE_ENS handler...");
        const client = getPublicClient(runtime);
        
        const text = message.content.text;
        const nameMatch = text.match(/([a-zA-Z0-9-]+\.eth)/i);
        
        if (!nameMatch) {
             if (callback) callback({ text: "Please provide a valid ENS name (e.g. vitalik.eth)" });
             return { success: false };
        }
        
        const ensName = nameMatch[0];

        try {
            const address = await client.getEnsAddress({
                name: normalize(ensName),
            });

            if (address) {
                if (callback) {
                    callback({
                        text: `The address for ${ensName} is ${address}`,
                        content: { address, ensName }
                    });
                }
                return { success: true, content: { address, ensName } };
            } else {
                 if (callback) callback({ text: `Could not resolve address for ${ensName}` });
                 return { success: false };
            }
        } catch (error) {
            elizaLogger.error("Error resolving ENS:", error);
            if (callback) callback({ text: `Error resolving ENS name: ${error.message}` });
            return { success: false };
        }
    },
    examples: [
        [
            { user: "{{user1}}", content: { text: "What is the address for vitalik.eth?" } },
            { user: "{{agentName}}", content: { text: "The address for vitalik.eth is 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" } }
        ]
    ]
};

export const reverseResolveEnsAction: Action = {
    name: "REVERSE_RESOLVE_ENS",
    similes: ["LOOKUP_ADDRESS", "GET_ENS_NAME", "REVERSE_LOOKUP"],
    description: "Resolve an Ethereum address to its primary ENS name.",
    validate: async (runtime: IAgentRuntime) => {
        return !!runtime.getSetting("ETHEREUM_PROVIDER_URL");
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        elizaLogger.log("Starting REVERSE_RESOLVE_ENS handler...");
        const client = getPublicClient(runtime);
        
        const text = message.content.text;
        const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
        
        if (!addressMatch) {
             if (callback) callback({ text: "Please provide a valid Ethereum address." });
             return { success: false };
        }
        
        const address = addressMatch[0] as `0x${string}`;

        try {
            const name = await client.getEnsName({
                address: address,
            });

            if (name) {
                if (callback) {
                    callback({
                        text: `The primary name for ${address} is ${name}`,
                        content: { address, ensName: name }
                    });
                }
                return { success: true, content: { address, ensName: name } };
            } else {
                 if (callback) callback({ text: `No primary ENS name found for ${address}` });
                 return { success: false };
            }
        } catch (error) {
            elizaLogger.error("Error reverse resolving ENS:", error);
            if (callback) callback({ text: `Error resolving address: ${error.message}` });
            return { success: false };
        }
    },
    examples: [
        [
            { user: "{{user1}}", content: { text: "Who owns 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?" } },
            { user: "{{agentName}}", content: { text: "The primary name for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 is vitalik.eth" } }
        ]
    ]
};
