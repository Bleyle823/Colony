import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const circleEnvSchema = z.object({
    CIRCLE_API_KEY: z.string().min(1, "Circle API Key is required"),
    CIRCLE_ENTITY_SECRET: z.string().min(1, "Circle Entity Secret is required"),
    EVM_PRIVATE_KEY: z.string().optional(), // For BridgeKit
    SOLANA_PRIVATE_KEY: z.string().optional(), // For BridgeKit
});

export type CircleConfig = z.infer<typeof circleEnvSchema>;

export async function validateCircleConfig(
    runtime: IAgentRuntime
): Promise<CircleConfig> {
    try {
        const config = {
            CIRCLE_API_KEY: runtime.getSetting("CIRCLE_API_KEY"),
            CIRCLE_ENTITY_SECRET: runtime.getSetting("CIRCLE_ENTITY_SECRET"),
            EVM_PRIVATE_KEY: runtime.getSetting("EVM_PRIVATE_KEY"),
            SOLANA_PRIVATE_KEY: runtime.getSetting("SOLANA_PRIVATE_KEY"),
        };

        return circleEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Circle configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
