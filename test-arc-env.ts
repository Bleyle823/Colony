import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export const arcEnvSchema = z.object({
    ARC_PRIVATE_KEY: z.string().min(1, "Arc private key is required"),
    ARC_RPC_URL: z.string().optional().default("https://rpc.testnet.arc.network"),
});

console.log("Checking environment...");
console.log("ARC_PRIVATE_KEY present:", !!process.env.ARC_PRIVATE_KEY);
if (process.env.ARC_PRIVATE_KEY) {
    console.log("ARC_PRIVATE_KEY length:", process.env.ARC_PRIVATE_KEY.length);
}
console.log("ARC_RPC_URL:", process.env.ARC_RPC_URL);

try {
    const config = {
        ARC_PRIVATE_KEY: process.env.ARC_PRIVATE_KEY,
        ARC_RPC_URL: process.env.ARC_RPC_URL,
    };
    arcEnvSchema.parse(config);
    console.log("Validation successful");
} catch (error) {
    console.log("Validation failed:", error);
}
