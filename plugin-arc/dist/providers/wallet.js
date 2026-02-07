import { createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../chain.js";
import { validateArcConfig } from "../environment.js";
const cache = new Map();
function getCached(key) {
    const entry = cache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
function setCache(key, data, ttlMs) {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: ttlMs
    });
}
function isArcRelated(message) {
    const text = message.content?.text?.toLowerCase() || "";
    const arcKeywords = [
        'wallet', 'address', 'balance', 'arc', 'usdc', 'send', 'transfer',
        'bridge', 'my address', 'what is my', 'check balance', 'how much'
    ];
    return arcKeywords.some(keyword => text.includes(keyword));
}
export const walletProvider = {
    name: "arc_wallet_provider",
    position: 0, // Run conditionally based on message content
    get: async (runtime, message, _state) => {
        // Only execute for Arc-related messages
        if (!isArcRelated(message)) {
            return { text: "" };
        }
        console.log("DEBUG: Executing Arc Wallet Provider (message is Arc-related)");
        try {
            const config = await validateArcConfig(runtime);
            if (!config) {
                console.log("DEBUG: Arc Config validation failed in provider");
                return { text: "" };
            }
            const account = privateKeyToAccount(config.ARC_PRIVATE_KEY.startsWith("0x") ? config.ARC_PRIVATE_KEY : `0x${config.ARC_PRIVATE_KEY}`);
            const address = account.address;
            // Cache wallet address (it doesn't change)
            const addressCacheKey = `arc_address_${config.ARC_PRIVATE_KEY.slice(-8)}`;
            let cachedAddress = getCached(addressCacheKey);
            if (!cachedAddress) {
                cachedAddress = address;
                setCache(addressCacheKey, address, 24 * 60 * 60 * 1000); // Cache for 24 hours
            }
            console.log(`DEBUG: Found address ${address}`);
            // Check if we need balance (only for balance-related queries)
            const text = message.content?.text?.toLowerCase() || "";
            const needsBalance = text.includes('balance') || text.includes('how much') || text.includes('usdc');
            if (!needsBalance) {
                // Return just the address for non-balance queries
                return {
                    text: `Arc Wallet Address: ${address}`,
                    values: {
                        arc_wallet_address: address
                    }
                };
            }
            // Check cache for balance (30 second TTL)
            const balanceCacheKey = `arc_balance_${address}`;
            let cachedBalance = getCached(balanceCacheKey);
            if (cachedBalance) {
                return {
                    text: `Arc Wallet Address: ${address}\nArc Wallet Balance: ${cachedBalance} USDC`,
                    values: {
                        arc_wallet_address: address,
                        arc_wallet_balance: cachedBalance
                    }
                };
            }
            // Fetch balance with shorter timeout
            const publicClient = createPublicClient({
                chain: arcTestnet,
                transport: http(config.ARC_RPC_URL)
            });
            const balancePromise = publicClient.getBalance({ address });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Balance fetch timeout')), 2000) // Reduced to 2s
            );
            const balance = await Promise.race([balancePromise, timeoutPromise]);
            const formattedBalance = formatEther(balance);
            // Cache the balance
            setCache(balanceCacheKey, formattedBalance, 30000); // 30 second cache
            return {
                text: `Arc Wallet Address: ${address}\nArc Wallet Balance: ${formattedBalance} USDC`,
                values: {
                    arc_wallet_address: address,
                    arc_wallet_balance: formattedBalance
                }
            };
        }
        catch (error) {
            console.error("Error in Arc wallet provider:", error);
            // Try to return cached address even if balance fetch fails
            const config = await validateArcConfig(runtime).catch(() => null);
            if (config) {
                const account = privateKeyToAccount(config.ARC_PRIVATE_KEY.startsWith("0x") ? config.ARC_PRIVATE_KEY : `0x${config.ARC_PRIVATE_KEY}`);
                const address = account.address;
                return {
                    text: `Arc Wallet Address: ${address}\nArc Wallet Balance: Unable to fetch balance`,
                    values: {
                        arc_wallet_address: address,
                        arc_wallet_balance: "Error"
                    }
                };
            }
            return { text: "" };
        }
    },
};
