import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";
export declare const arcEnvSchema: z.ZodObject<{
    ARC_PRIVATE_KEY: z.ZodString;
    ARC_RPC_URL: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    ARC_PRIVATE_KEY: string;
    ARC_RPC_URL: string;
}, {
    ARC_PRIVATE_KEY: string;
    ARC_RPC_URL?: string | undefined;
}>;
export type ArcConfig = z.infer<typeof arcEnvSchema>;
export declare function validateArcConfig(runtime: IAgentRuntime): Promise<ArcConfig | null>;
