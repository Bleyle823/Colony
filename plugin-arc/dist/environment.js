import { z } from "zod";
export const arcEnvSchema = z.object({
    ARC_PRIVATE_KEY: z.string().min(1, "Arc private key is required"),
    ARC_RPC_URL: z.string().optional().default("https://rpc.testnet.arc.network"),
    SOLANA_PRIVATE_KEY: z.string().optional(), // Required only for bridging to/from Solana
});
export async function validateArcConfig(runtime) {
    try {
        const config = {
            ARC_PRIVATE_KEY: runtime.getSetting("ARC_PRIVATE_KEY") || process.env.ARC_PRIVATE_KEY,
            ARC_RPC_URL: runtime.getSetting("ARC_RPC_URL") || process.env.ARC_RPC_URL,
            SOLANA_PRIVATE_KEY: runtime.getSetting("SOLANA_PRIVATE_KEY") || process.env.SOLANA_PRIVATE_KEY,
        };
        console.log("Validating Arc Config:", {
            hasArcKey: !!config.ARC_PRIVATE_KEY,
            hasSolanaKey: !!config.SOLANA_PRIVATE_KEY
        });
        return arcEnvSchema.parse(config);
    }
    catch (error) {
        console.log("Arc Config Validation Failed:", error);
        return null;
    }
}
