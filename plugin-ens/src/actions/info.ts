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

export const getEnsAvatarAction: Action = {
    name: "GET_ENS_AVATAR",
    similes: ["SHOW_ENS_AVATAR", "FETCH_AVATAR", "GET_PROFILE_PIC"],
    description: "Retrieve the avatar URI for a given ENS name.",
    validate: async (runtime: IAgentRuntime) => {
        return !!(runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL"));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        const client = getPublicClient(runtime);
        const text = message.content.text;
        const nameMatch = text.match(/([a-zA-Z0-9-]+\.eth)/i);
        
        if (!nameMatch) {
             if (callback) callback({ text: "Please provide a valid ENS name." });
             return { success: false };
        }
        
        const ensName = nameMatch[0];

        try {
            const avatar = await client.getEnsAvatar({
                name: normalize(ensName),
            });

            if (avatar) {
                if (callback) {
                    callback({
                        text: `The avatar for ${ensName} is: ${avatar}`,
                        content: { ensName, avatar }
                    });
                }
                return { success: true, content: { ensName, avatar } };
            } else {
                 if (callback) callback({ text: `No avatar set for ${ensName}` });
                 return { success: false };
            }
        } catch (error) {
             elizaLogger.error("Error fetching avatar:", error);
             if (callback) callback({ text: `Failed to fetch avatar: ${error.message}` });
             return { success: false };
        }
    },
    examples: [
        [
             { user: "{{user1}}", content: { text: "Show me vitalik.eth's avatar" } },
             { user: "{{agentName}}", content: { text: "The avatar for vitalik.eth is: https://ipfs.io/ipfs/..." } }
        ]
    ]
};

export const getEnsTextAction: Action = {
    name: "GET_ENS_TEXT",
    similes: ["READ_ENS_TEXT", "GET_TXT_RECORD", "FETCH_ENS_KEY"],
    description: "Read arbitrary text records for an ENS name (e.g. email, twitter, url).",
    validate: async (runtime: IAgentRuntime) => {
        return !!(runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL"));
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<ActionResult> => {
        const client = getPublicClient(runtime);
        const text = message.content.text;
        const nameMatch = text.match(/([a-zA-Z0-9-]+\.eth)/i);
        
        // Simple heuristic to find the key. 
        // e.g. "Get email for vitalik.eth" -> key = email
        // We might need a better extraction logic or just assume common keys
        // or split by " for " or " of ". 
        // For simplicity: look for common keys or the word before "for [name]"
        
        // Let's look for known keys first: email, url, avatar, description, notice, keywords, twitter, github
        const knownKeys = ["email", "url", "avatar", "description", "notice", "keywords", "com.twitter", "com.github", "twitter", "github"];
        let key = knownKeys.find(k => text.toLowerCase().includes(k));
        
        // Normalize shorthand keys
        if (key === "twitter") key = "com.twitter";
        if (key === "github") key = "com.github";

        if (!nameMatch || !key) {
             if (callback) callback({ text: "Please specify a valid ENS name and the text record key (e.g. email, twitter, url)." });
             return { success: false };
        }
        
        const ensName = nameMatch[0];

        try {
            const value = await client.getEnsText({
                name: normalize(ensName),
                key: key,
            });

            if (value) {
                if (callback) {
                    callback({
                        text: `The ${key} record for ${ensName} is: ${value}`,
                        content: { ensName, key, value }
                    });
                }
                return { success: true, content: { ensName, key, value } };
            } else {
                 if (callback) callback({ text: `No ${key} record found for ${ensName}` });
                 return { success: false };
            }
        } catch (error) {
             elizaLogger.error("Error fetching text record:", error);
             if (callback) callback({ text: `Failed to fetch record: ${error.message}` });
             return { success: false };
        }
    },
    examples: [
        [
             { user: "{{user1}}", content: { text: "What is the email for nick.eth?" } },
             { user: "{{agentName}}", content: { text: "The email record for nick.eth is: nick@ens.domains" } }
        ]
    ]
};
