import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export const kaminoEnvSchema = z.object({
    SOLANA_PRIVATE_KEY: z.string().min(1, "Solana private key is required"),
    SOLANA_RPC_URL: z.string().min(1, "Solana RPC URL is required"),
    SOLANA_PUBLIC_KEY: z.string().optional().describe("Solana public key for validation"),
    KAMINO_RWA_MINT: z.string().optional().describe("Default RWA token mint address"),
});

export type KaminoConfig = z.infer<typeof kaminoEnvSchema>;

// Helper function to create Keypair from various private key formats
export function createKeypairFromPrivateKey(privateKey: string): Keypair {
    try {
        // Try base58 format first (most common)
        if (privateKey.length > 80) {
            return Keypair.fromSecretKey(bs58.decode(privateKey));
        }
        
        // Try hex format (with or without 0x prefix)
        let hexKey = privateKey;
        if (hexKey.startsWith('0x')) {
            hexKey = hexKey.slice(2);
        }
        
        if (hexKey.length === 64) {
            // 32 bytes hex string
            const secretKey = new Uint8Array(Buffer.from(hexKey, 'hex'));
            return Keypair.fromSecretKey(secretKey);
        }
        
        // Try array format [1,2,3,...]
        if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
            const arrayKey = JSON.parse(privateKey);
            return Keypair.fromSecretKey(new Uint8Array(arrayKey));
        }
        
        // Try comma-separated format
        if (privateKey.includes(',')) {
            const arrayKey = privateKey.split(',').map(n => parseInt(n.trim()));
            return Keypair.fromSecretKey(new Uint8Array(arrayKey));
        }
        
        // Last resort: try as base58 anyway
        return Keypair.fromSecretKey(bs58.decode(privateKey));
        
    } catch (error) {
        throw new Error(`Invalid private key format. Supported formats: base58, hex (with/without 0x), or array. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function validateKaminoConfig(
    runtime: IAgentRuntime
): Promise<KaminoConfig & { keypair: Keypair }> {
    try {
        const config = {
            SOLANA_PRIVATE_KEY: runtime.getSetting("SOLANA_PRIVATE_KEY") || process.env.SOLANA_PRIVATE_KEY,
            SOLANA_RPC_URL: runtime.getSetting("SOLANA_RPC_URL") || process.env.SOLANA_RPC_URL,
            SOLANA_PUBLIC_KEY: runtime.getSetting("SOLANA_PUBLIC_KEY") || process.env.SOLANA_PUBLIC_KEY,
            KAMINO_RWA_MINT: runtime.getSetting("KAMINO_RWA_MINT") || process.env.KAMINO_RWA_MINT,
        };

        const validatedConfig = kaminoEnvSchema.parse(config);
        
        // Create and validate keypair
        const keypair = createKeypairFromPrivateKey(validatedConfig.SOLANA_PRIVATE_KEY);
        
        // Validate public key if provided
        if (validatedConfig.SOLANA_PUBLIC_KEY) {
            const expectedPublicKey = keypair.publicKey.toBase58();
            if (expectedPublicKey !== validatedConfig.SOLANA_PUBLIC_KEY) {
                throw new Error(`Private key does not match expected public key. Expected: ${validatedConfig.SOLANA_PUBLIC_KEY}, Got: ${expectedPublicKey}`);
            }
        }
        
        return {
            ...validatedConfig,
            keypair
        };
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
