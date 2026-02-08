import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { validateKaminoConfig } from "./src/environment.js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

// Mock runtime for testing
const mockRuntime = {
    getSetting: (key: string) => process.env[key],
};

async function comprehensiveTSLAxCheck() {
    console.log("🔍 Comprehensive TSLAx Balance Check...\n");
    
    // Known TSLAx mint addresses (there might be multiple)
    const possibleTSLAxMints = [
        "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", // From constants
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC for comparison
        // Add other possible TSLAx mints if known
    ];
    
    try {
        // 1. Validate configuration
        console.log("1. Validating wallet configuration...");
        const config = await validateKaminoConfig(mockRuntime as any);
        console.log(`   ✅ Wallet: ${config.keypair.publicKey.toBase58()}`);
        
        // 2. Connect to Solana
        console.log("\n2. Connecting to Solana...");
        const connection = new Connection(config.SOLANA_RPC_URL);
        const slot = await connection.getSlot();
        console.log(`   ✅ Connected (slot: ${slot})`);
        
        // 3. Check all token accounts owned by the wallet
        console.log("\n3. Scanning all token accounts in wallet...");
        
        try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                config.keypair.publicKey,
                {
                    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                }
            );
            
            console.log(`   📊 Found ${tokenAccounts.value.length} token accounts`);
            
            if (tokenAccounts.value.length === 0) {
                console.log(`   ℹ️  No token accounts found in wallet`);
            } else {
                console.log(`\n   📋 Token Account Details:`);
                
                let tslaXFound = false;
                
                for (let i = 0; i < tokenAccounts.value.length; i++) {
                    const account = tokenAccounts.value[i];
                    const accountData = account.account.data.parsed.info;
                    const mint = accountData.mint;
                    const balance = accountData.tokenAmount.uiAmount || 0;
                    const decimals = accountData.tokenAmount.decimals;
                    
                    console.log(`   ${i + 1}. Account: ${account.pubkey.toBase58()}`);
                    console.log(`      Mint: ${mint}`);
                    console.log(`      Balance: ${balance} (${decimals} decimals)`);
                    
                    // Check if this is TSLAx
                    if (mint === "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB") {
                        console.log(`      🚗 THIS IS TSLAx! Balance: ${balance} TSLAx`);
                        tslaXFound = true;
                        
                        if (balance > 0) {
                            console.log(`      ✅ You have TSLAx available for collateral!`);
                            const estimatedBorrowPower = balance * 0.7;
                            console.log(`      📊 Estimated borrowing power: ~${estimatedBorrowPower.toFixed(2)} USDC (at 70% LTV)`);
                        }
                    }
                    
                    console.log("");
                }
                
                if (!tslaXFound) {
                    console.log(`   ⚠️  No TSLAx tokens found in any account`);
                    console.log(`   🔍 Looking for mint: XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB`);
                }
            }
            
        } catch (tokenError) {
            console.error(`   ❌ Error scanning token accounts:`, tokenError);
        }
        
        // 4. Specifically check the expected TSLAx token account
        console.log("\n4. Checking specific TSLAx token account...");
        const tslaXMint = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
        
        try {
            const tokenAccountAddress = await getAssociatedTokenAddress(
                new PublicKey(tslaXMint),
                config.keypair.publicKey
            );
            
            console.log(`   📍 Expected TSLAx Account: ${tokenAccountAddress.toBase58()}`);
            
            const accountInfo = await connection.getAccountInfo(tokenAccountAddress);
            
            if (accountInfo === null) {
                console.log(`   ℹ️  TSLAx token account does not exist`);
                console.log(`   💡 This means you haven't received any TSLAx tokens yet`);
            } else {
                const account = await getAccount(connection, tokenAccountAddress);
                const balance = Number(account.amount) / Math.pow(10, 6);
                console.log(`   💰 TSLAx Balance: ${balance.toFixed(6)} TSLAx`);
            }
            
        } catch (specificError) {
            console.error(`   ❌ Error checking specific TSLAx account:`, specificError);
        }
        
        // 5. Check SOL balance
        console.log("\n5. Checking SOL balance...");
        const solBalance = await connection.getBalance(config.keypair.publicKey);
        const solAmount = solBalance / 1e9;
        console.log(`   💰 SOL Balance: ${solAmount.toFixed(4)} SOL`);
        
        console.log("\n🎯 Summary:");
        console.log(`   • Wallet Address: ${config.keypair.publicKey.toBase58()}`);
        console.log(`   • Network: Solana Mainnet`);
        console.log(`   • TSLAx Mint: XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB`);
        
        console.log("\n💡 If you believe you have TSLAx but it's not showing:");
        console.log("   1. Double-check the wallet address matches where you sent TSLAx");
        console.log("   2. Verify the TSLAx mint address is correct");
        console.log("   3. Check if the transaction is fully confirmed on-chain");
        console.log("   4. Try checking on Solscan: https://solscan.io/account/" + config.keypair.publicKey.toBase58());
        
    } catch (error) {
        console.error("❌ Comprehensive check failed:", error);
    }
}

// Run the comprehensive check
comprehensiveTSLAxCheck().catch(console.error);