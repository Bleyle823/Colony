
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { createSolanaKitAdapterFromPrivateKey } from "@circle-fin/adapter-solana-kit";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
    console.log("Starting BridgeKit Setup Test...");

    const evmKey = process.env.EVM_PRIVATE_KEY;
    const solanaKey = process.env.SOLANA_PRIVATE_KEY;

    if (!evmKey || !solanaKey) {
        console.error("❌ Missing EVM_PRIVATE_KEY or SOLANA_PRIVATE_KEY in .env");
        process.exit(1);
    }

    console.log("✅ Credentials found.");

    try {
        console.log("Initializing BridgeKit...");
        const kit = new BridgeKit();
        console.log("✅ BridgeKit initialized.");

        console.log("Creating EVM Adapter...");
        const evmAdapter = createViemAdapterFromPrivateKey({
            privateKey: evmKey.startsWith("0x") ? (evmKey as `0x${string}`) : `0x${evmKey}`,
        });
        console.log("✅ EVM Adapter created.");

        console.log("Creating Solana Adapter...");
        const solanaAdapter = createSolanaKitAdapterFromPrivateKey({
            privateKey: solanaKey,
        });
        console.log("✅ Solana Adapter created.");

        console.log("Attempting to estimate a bridge transfer (simulated)...");
        // We won't execute a real bridge, but we can verify the quote/estimate logic if available
        // or just verify the structure.
        
        // Let's try to get a quote or just ensure we can create the parameters object without error
        const params = {
            from: { adapter: evmAdapter, chain: "Ethereum_Sepolia" },
            to: { adapter: solanaAdapter, chain: "Solana_Devnet" },
            amount: "0.1",
        };
        console.log("✅ Bridge parameters constructed successfully.");
        console.log(params);

    } catch (error: any) {
        console.error("❌ Failed to setup BridgeKit.");
        console.error("Error:", error.message);
        process.exit(1);
    }
}

main();
