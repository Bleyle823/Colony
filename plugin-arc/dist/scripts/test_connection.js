import { createPublicClient, http } from "viem";
import { arcTestnet } from "../chain.js";
async function main() {
    console.log("Testing connection to Arc Testnet...");
    const client = createPublicClient({
        chain: arcTestnet,
        transport: http()
    });
    try {
        const blockNumber = await client.getBlockNumber();
        console.log(`Successfully connected! Current block number: ${blockNumber}`);
    }
    catch (error) {
        console.error("Failed to connect to Arc Testnet:", error);
        process.exit(1);
    }
}
main();
