import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const kaminoEnvSchema = z.object({
    SOLANA_PRIVATE_KEY: z.string().min(1, "Solana private key is required"),
    SOLANA_RPC_URL: z.string().min(1, "Solana RPC URL is required"),
    KAMINO_RWA_MINT: z.string().optional().describe("Default RWA token mint address"),
});

export type KaminoConfig = z.infer<typeof kaminoEnvSchema>;

export async function validateKaminoConfig(
    runtime: IAgentRuntime
): Promise<KaminoConfig> {
    try {
        const config = {
            SOLANA_PRIVATE_KEY: runtime.getSetting("SOLANA_PRIVATE_KEY") || process.env.SOLANA_PRIVATE_KEY,
            SOLANA_RPC_URL: runtime.getSetting("SOLANA_RPC_URL") || process.env.SOLANA_RPC_URL,
            KAMINO_RWA_MINT: runtime.getSetting("KAMINO_RWA_MINT") || process.env.KAMINO_RWA_MINT,
        };

        return kaminoEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Kamino configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
