import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const solanaEnvSchema = z.object({
    SOLANA_RPC_URL: z.string().url().optional().default("https://api.mainnet-beta.solana.com"),
    SOLANA_PRIVATE_KEY: z.string().min(1, "Solana private key is required"),
    SOLANA_COMMITMENT: z.enum(["processed", "confirmed", "finalized"]).optional().default("confirmed"),
});

export type SolanaConfig = z.infer<typeof solanaEnvSchema>;

export async function validateSolanaConfig(
    runtime: IAgentRuntime
): Promise<SolanaConfig> {
    try {
        const config = {
            SOLANA_RPC_URL: runtime.getSetting("SOLANA_RPC_URL") || process.env.SOLANA_RPC_URL,
            SOLANA_PRIVATE_KEY: runtime.getSetting("SOLANA_PRIVATE_KEY") || process.env.SOLANA_PRIVATE_KEY,
            SOLANA_COMMITMENT: runtime.getSetting("SOLANA_COMMITMENT") || process.env.SOLANA_COMMITMENT,
        };

        return solanaEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Solana configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}