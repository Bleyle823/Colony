// src/actions/resolve.ts
import {
  elizaLogger
} from "@elizaos/core";

// src/utils.ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
var getPublicClient = (runtime) => {
  const transportUrl = runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL") || "https://eth.llamarpc.com";
  return createPublicClient({
    chain: mainnet,
    transport: http(transportUrl)
  });
};

// src/actions/resolve.ts
import { normalize } from "viem/ens";
var resolveEnsAction = {
  name: "RESOLVE_ENS",
  similes: ["RESOLVE_NAME", "GET_ENS_ADDRESS", "WHOIS_ENS", "LOOKUP_ENS"],
  description: "Resolve an ENS name to an Ethereum address.",
  validate: async (runtime) => {
    return !!(runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL"));
  },
  handler: async (runtime, message, state, _options, callback) => {
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
        name: normalize(ensName)
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
var reverseResolveEnsAction = {
  name: "REVERSE_RESOLVE_ENS",
  similes: ["LOOKUP_ADDRESS", "GET_ENS_NAME", "REVERSE_LOOKUP"],
  description: "Resolve an Ethereum address to its primary ENS name.",
  validate: async (runtime) => {
    return !!(runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL"));
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger.log("Starting REVERSE_RESOLVE_ENS handler...");
    const client = getPublicClient(runtime);
    const text = message.content.text;
    const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
    if (!addressMatch) {
      if (callback) callback({ text: "Please provide a valid Ethereum address." });
      return { success: false };
    }
    const address = addressMatch[0];
    try {
      const name = await client.getEnsName({
        address
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

// src/actions/info.ts
import {
  elizaLogger as elizaLogger2
} from "@elizaos/core";
import { normalize as normalize2 } from "viem/ens";
var getEnsAvatarAction = {
  name: "GET_ENS_AVATAR",
  similes: ["SHOW_ENS_AVATAR", "FETCH_AVATAR", "GET_PROFILE_PIC"],
  description: "Retrieve the avatar URI for a given ENS name.",
  validate: async (runtime) => {
    return !!(runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL"));
  },
  handler: async (runtime, message, state, _options, callback) => {
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
        name: normalize2(ensName)
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
      elizaLogger2.error("Error fetching avatar:", error);
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
var getEnsTextAction = {
  name: "GET_ENS_TEXT",
  similes: ["READ_ENS_TEXT", "GET_TXT_RECORD", "FETCH_ENS_KEY"],
  description: "Read arbitrary text records for an ENS name (e.g. email, twitter, url).",
  validate: async (runtime) => {
    return !!runtime.getSetting("ETHEREUM_PROVIDER_URL");
  },
  handler: async (runtime, message, state, _options, callback) => {
    const client = getPublicClient(runtime);
    const text = message.content.text;
    const nameMatch = text.match(/([a-zA-Z0-9-]+\.eth)/i);
    const knownKeys = ["email", "url", "avatar", "description", "notice", "keywords", "com.twitter", "com.github", "twitter", "github"];
    let key = knownKeys.find((k) => text.toLowerCase().includes(k));
    if (key === "twitter") key = "com.twitter";
    if (key === "github") key = "com.github";
    if (!nameMatch || !key) {
      if (callback) callback({ text: "Please specify a valid ENS name and the text record key (e.g. email, twitter, url)." });
      return { success: false };
    }
    const ensName = nameMatch[0];
    try {
      const value = await client.getEnsText({
        name: normalize2(ensName),
        key
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
      elizaLogger2.error("Error fetching text record:", error);
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

// src/actions/manage.ts
import {
  elizaLogger as elizaLogger3
} from "@elizaos/core";
import { normalize as normalize3, namehash } from "viem/ens";
import { createWalletClient as createWalletClient2, http as http2 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet as mainnet2 } from "viem/chains";
var RESOLVER_ABI = [
  {
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" }
    ],
    name: "setText",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "a", type: "address" }
    ],
    name: "setAddr",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];
var getWallet = (runtime) => {
  const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
  if (!privateKey) return null;
  const account = privateKeyToAccount(privateKey);
  return createWalletClient2({
    account,
    chain: mainnet2,
    transport: http2(runtime.getSetting("ETHEREUM_PROVIDER_URL") || runtime.getSetting("EVM_PROVIDER_URL") || "https://cloudflare-eth.com")
  });
};
var setEnsTextAction = {
  name: "SET_ENS_TEXT",
  similes: ["UPDATE_ENS_TEXT", "SET_TEXT_RECORD", "CHANGE_ENS_KEY"],
  description: "Set a text record for an ENS name. Requires the agent to be the owner/controller.",
  validate: async (runtime) => {
    return !!runtime.getSetting("EVM_PRIVATE_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
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
      const resolverAddress = await publicClient.getEnsResolver({ name: normalize3(ensName) });
      if (!resolverAddress) {
        if (callback) callback({ text: `No resolver found for ${ensName}` });
        return { success: false };
      }
      const hash = await walletClient.writeContract({
        address: resolverAddress,
        abi: RESOLVER_ABI,
        functionName: "setText",
        args: [namehash(normalize3(ensName)), key, value]
      });
      if (callback) {
        callback({
          text: `Transaction sent to set ${key} for ${ensName}. Hash: ${hash}`,
          content: { txHash: hash, ensName, key, value }
        });
      }
      return { success: true, content: { txHash: hash } };
    } catch (error) {
      elizaLogger3.error("Error setting ENS text:", error);
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
var setEnsAddressAction = {
  name: "SET_ENS_ADDRESS",
  similes: ["SET_ENS_ADDR", "POINT_ENS_TO_ADDRESS", "UPDATE_ENS_ADDRESS"],
  description: "Set the Ethereum address (ETH record) for an ENS name.",
  validate: async (runtime) => {
    return !!runtime.getSetting("EVM_PRIVATE_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
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
      const resolverAddress = await publicClient.getEnsResolver({ name: normalize3(ensName) });
      if (!resolverAddress) {
        if (callback) callback({ text: `No resolver found for ${ensName}` });
        return { success: false };
      }
      const hash = await walletClient.writeContract({
        address: resolverAddress,
        abi: RESOLVER_ABI,
        functionName: "setAddr",
        args: [namehash(normalize3(ensName)), address]
      });
      if (callback) {
        callback({
          text: `Transaction sent to set address for ${ensName} to ${address}. Hash: ${hash}`,
          content: { txHash: hash, ensName, address }
        });
      }
      return { success: true, content: { txHash: hash } };
    } catch (error) {
      elizaLogger3.error("Error setting ENS address:", error);
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
var setEnsAvatarAction = {
  name: "SET_ENS_AVATAR",
  similes: ["UPDATE_ENS_AVATAR", "CHANGE_PROFILE_PIC", "SET_AVATAR"],
  description: "Set the avatar for an ENS name.",
  validate: async (runtime) => {
    return !!runtime.getSetting("EVM_PRIVATE_KEY");
  },
  handler: async (runtime, message, state, _options, callback) => {
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
      const resolverAddress = await publicClient.getEnsResolver({ name: normalize3(ensName) });
      if (!resolverAddress) {
        if (callback) callback({ text: `No resolver found for ${ensName}` });
        return { success: false };
      }
      const hash = await walletClient.writeContract({
        address: resolverAddress,
        abi: RESOLVER_ABI,
        functionName: "setText",
        args: [namehash(normalize3(ensName)), "avatar", avatarUrl]
      });
      if (callback) {
        callback({
          text: `Transaction sent to set avatar for ${ensName}. Hash: ${hash}`,
          content: { txHash: hash, ensName, avatarUrl }
        });
      }
      return { success: true, content: { txHash: hash } };
    } catch (error) {
      elizaLogger3.error("Error setting ENS avatar:", error);
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

// src/index.ts
var ensPlugin = {
  name: "ens",
  description: "Ethereum Name Service (ENS) integration for resolving names, fetching avatars/text records, and managing records.",
  actions: [
    resolveEnsAction,
    reverseResolveEnsAction,
    getEnsAvatarAction,
    getEnsTextAction,
    setEnsTextAction,
    setEnsAddressAction,
    setEnsAvatarAction
  ],
  providers: [],
  services: []
};
var index_default = ensPlugin;
export {
  index_default as default,
  ensPlugin
};
