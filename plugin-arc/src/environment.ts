import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const arcEnvSchema = z.object({
    ARC_PRIVATE_KEY: z.string().min(1, "Arc private key is required"),
    ARC_RPC_URL: z.string().optional().default("https://rpc.testnet.arc.network"),
});

export type ArcConfig = z.infer<typeof arcEnvSchema>;

export async function validateArcConfig(
    runtime: IAgentRuntime
): Promise<ArcConfig | null> {
    try {
        const config = {
            ARC_PRIVATE_KEY: runtime.getSetting("ARC_PRIVATE_KEY") || process.env.ARC_PRIVATE_KEY,
            ARC_RPC_URL: runtime.getSetting("ARC_RPC_URL") || process.env.ARC_RPC_URL,
        };
        console.log("Validating Arc Config:", { hasKey: !!config.ARC_PRIVATE_KEY });
        return arcEnvSchema.parse(config);
    } catch (error) {
        console.log("Arc Config Validation Failed:", error);
        return null;
    }
}
