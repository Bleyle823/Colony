import { createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import * as dotenv from "dotenv";

dotenv.config();

const arcTestnet = defineChain({
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'USDC',
        symbol: 'USDC',
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.testnet.arc.network'],
        },
    },
    testnet: true,
});

async function main() {
    console.log("Testing Arc Balance...");

    const privateKey = process.env.ARC_PRIVATE_KEY;
    if (!privateKey) {
        console.error("Error: ARC_PRIVATE_KEY not found in .env");
        return;
    }

    try {
        const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey as `0x${string}` : `0x${privateKey}`);
        console.log("Address:", account.address);

        const client = createPublicClient({
            chain: arcTestnet,
            transport: http("https://rpc.testnet.arc.network")
        });

        const balance = await client.getBalance({
            address: account.address
        });

        console.log("Raw Balance:", balance.toString());
        console.log("Formatted Balance:", formatEther(balance), "USDC");

    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

main();
