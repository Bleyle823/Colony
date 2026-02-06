import { createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../chain.js";
import { validateArcConfig } from "../environment.js";
export const walletProvider = {
    name: "arc_wallet_provider",
    get: async (runtime, _message, _state) => {
        console.log("DEBUG: Executing Arc Wallet Provider");
        try {
            const config = await validateArcConfig(runtime);
            if (!config) {
                console.log("DEBUG: Arc Config validation failed in provider");
                return { text: "" };
            }
            const account = privateKeyToAccount(config.ARC_PRIVATE_KEY.startsWith("0x") ? config.ARC_PRIVATE_KEY : `0x${config.ARC_PRIVATE_KEY}`);
            const address = account.address;
            console.log(`DEBUG: Found address ${address}`);
            const publicClient = createPublicClient({
                chain: arcTestnet,
                transport: http(config.ARC_RPC_URL)
            });
            const balance = await publicClient.getBalance({
                address,
            });
            const formattedBalance = formatEther(balance);
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
            return { text: "" };
        }
    },
};
