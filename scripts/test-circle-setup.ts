
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import * as dotenv from "dotenv";
import * as path from "path";
import * as crypto from "crypto";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
    console.log("Starting Circle Plugin Setup Test...");

    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
        console.error("❌ Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in .env");
        process.exit(1);
    }

    console.log("✅ Credentials found.");

    const client = initiateDeveloperControlledWalletsClient({
        apiKey,
        entitySecret,
    });

    try {
        console.log("Attempting to list wallet sets...");
        const walletSetsRes = await client.listWalletSets();
        console.log(`✅ Successfully listed wallet sets. Found ${walletSetsRes.data?.walletSets?.length || 0} sets.`);
        
        // Try to create a test wallet set to verify Entity Secret
        // Note: We'll use a UUID for idempotency key as Circle often expects UUIDs
        const idempotencyKey = crypto.randomUUID();
        console.log(`Attempting to create a new wallet set with idempotency key: ${idempotencyKey}...`);
        
        try {
            const createSetRes = await client.createWalletSet({
                name: "Eliza Test Set",
                idempotencyKey: idempotencyKey
            });
            console.log("✅ Successfully created wallet set:", createSetRes.data?.walletSet?.id);
            
            // If successful, try to create a wallet in it
            const walletSetId = createSetRes.data?.walletSet?.id;
            if (walletSetId) {
                console.log("Attempting to create a wallet in the new set...");
                const walletIdempotencyKey = crypto.randomUUID();
                
                // Try EOA first as it's simpler
                console.log("Creating EOA wallet...");
                const createWalletRes = await client.createWallets({
                    accountType: "EOA",
                    blockchains: ["ETH-SEPOLIA"],
                    count: 1,
                    walletSetId: walletSetId,
                    idempotencyKey: walletIdempotencyKey
                });
                console.log("✅ Successfully created EOA wallet:", createWalletRes.data?.wallets?.[0]?.id);
                const wallet = createWalletRes.data?.wallets?.[0];
                
                if (wallet && wallet.address && wallet.blockchain) {
                    console.log(`Requesting testnet USDC for wallet ${wallet.id} (${wallet.address})...`);
                    try {
                        const fundRes = await client.requestTestnetTokens({
                            address: wallet.address,
                            blockchain: wallet.blockchain as any,
                            usdc: true
                        });
                        console.log("✅ Successfully requested testnet tokens.");
                        
                        console.log("Waiting for balance to update (sleeping 10s)...");
                        await new Promise(r => setTimeout(r, 10000));
                        
                        console.log("Checking wallet balance...");
                        const balanceRes = await client.getWalletTokenBalance({
                            id: wallet.id
                        });
                        console.log("Wallet balances:", JSON.stringify(balanceRes.data?.tokenBalances, null, 2));

                        // Attempt a transfer if balance > 0
                        const usdcBalance = balanceRes.data?.tokenBalances?.find((b: any) => b.token.symbol === "USDC");
                        if (usdcBalance && Number(usdcBalance.amount) > 0) {
                            console.log("Attempting self-transfer to test createTransaction...");
                             const transferIdempotencyKey = crypto.randomUUID();
                             const transferRes = await client.createTransaction({
                                walletId: wallet.id,
                                tokenId: usdcBalance.token.id,
                                destinationAddress: wallet.address, // Self transfer
                                amounts: ["0.1"],
                                fee: {
                                    type: "level",
                                    config: { feeLevel: "MEDIUM" }
                                },
                                idempotencyKey: transferIdempotencyKey
                             });
                             console.log("✅ Successfully created transaction:", transferRes.data?.id);
                        } else {
                            console.log("⚠️ No USDC balance yet, skipping transfer test.");
                        }

                    } catch (fundErr: any) {
                        console.error("❌ Failed during funding/transfer:", fundErr.message);
                         if (fundErr.response) {
                            console.error("API Error:", JSON.stringify(fundErr.response.data, null, 2));
                        }
                    }
                }
            }

        } catch (err: any) {
            console.error("❌ Failed to create wallet set/wallet.");
            console.dir(err, { depth: null });
        }

    } catch (error: any) {
        console.error("❌ Failed to interact with Circle API.");
        if (error.response) {
            console.error("API Error:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
        process.exit(1);
    }
}

main();
