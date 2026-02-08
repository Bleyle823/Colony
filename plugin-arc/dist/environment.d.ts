import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";
export declare const arcEnvSchema: z.ZodObject<{
    ARC_PRIVATE_KEY: z.ZodString;
    ARC_RPC_URL: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    SOLANA_PRIVATE_KEY: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ARC_PRIVATE_KEY: string;
    ARC_RPC_URL: string;
    SOLANA_PRIVATE_KEY?: string | undefined;
}, {
    ARC_PRIVATE_KEY: string;
    ARC_RPC_URL?: string | undefined;
    SOLANA_PRIVATE_KEY?: string | undefined;
}>;
export type ArcConfig = z.infer<typeof arcEnvSchema>;
export declare function validateArcConfig(runtime: IAgentRuntime): Promise<ArcConfig | null>;
