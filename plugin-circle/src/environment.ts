import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const circleEnvSchema = z.object({
    CIRCLE_API_KEY: z.string().min(1, "Circle API Key is required"),
    CIRCLE_ENTITY_SECRET: z.string().min(1, "Circle Entity Secret is required"),
    EVM_PRIVATE_KEY: z.string().optional(), // For BridgeKit
    SOLANA_PRIVATE_KEY: z.string().optional(), // For BridgeKit
    CIRCLE_WALLET_SET_ID: z.string().optional(), // For Programmable Wallets
    CIRCLE_GATEWAY_ENDPOINT: z.string().optional().default("https://api.circle.com/v1/gateway"), // Gateway API endpoint
    ENABLE_GAS_ABSTRACTION: z.boolean().optional().default(false), // Gas abstraction feature
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
            CIRCLE_WALLET_SET_ID: runtime.getSetting("CIRCLE_WALLET_SET_ID"),
            CIRCLE_GATEWAY_ENDPOINT: runtime.getSetting("CIRCLE_GATEWAY_ENDPOINT"),
            ENABLE_GAS_ABSTRACTION: runtime.getSetting("ENABLE_GAS_ABSTRACTION") === "true",
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
