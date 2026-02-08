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

async function checkTSLAxBalance() {
    console.log("🚗 Checking TSLAx Balance...\n");
    
    const tslaXMint = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
    
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
        
        // 3. Check TSLAx token account
        console.log("\n3. Checking TSLAx token account...");
        console.log(`   📍 TSLAx Mint: ${tslaXMint}`);
        console.log(`   📍 Wallet: ${config.keypair.publicKey.toBase58()}`);
        
        try {
            // Get the associated token account address
            const tokenAccountAddress = await getAssociatedTokenAddress(
                new PublicKey(tslaXMint),
                config.keypair.publicKey
            );
            
            console.log(`   📍 Token Account: ${tokenAccountAddress.toBase58()}`);
            
            // Check if the account exists and get balance
            const accountInfo = await connection.getAccountInfo(tokenAccountAddress);
            
            if (accountInfo === null) {
                console.log(`   💰 TSLAx Balance: 0.0000 TSLAx`);
                console.log(`   ℹ️  Token account does not exist (normal if you haven't received TSLAx yet)`);
                console.log(`   💡 The account will be created automatically when you receive TSLAx tokens`);
            } else {
                // Account exists, get the balance
                const account = await getAccount(connection, tokenAccountAddress);
                const decimals = 6; // TSLAx uses 6 decimals
                const balance = Number(account.amount) / Math.pow(10, decimals);
                
                console.log(`   💰 TSLAx Balance: ${balance.toFixed(6)} TSLAx`);
                
                if (balance > 0) {
                    console.log(`   ✅ You have TSLAx available!`);
                    console.log(`   💡 You can use this as collateral on Kamino`);
                    
                    // Estimate borrowing power (rough calculation)
                    const estimatedBorrowPower = balance * 0.7; // Assuming 70% LTV
                    console.log(`   📊 Estimated borrowing power: ~${estimatedBorrowPower.toFixed(2)} USDC (at 70% LTV)`);
                    
                    console.log(`\n🚀 Next steps:`);
                    console.log(`   • Deposit as collateral: "Deposit ${balance} TSLAx"`);
                    console.log(`   • Then borrow USDC: "Borrow ${estimatedBorrowPower.toFixed(0)} USDC"`);
                } else {
                    console.log(`   ⚠️  Account exists but balance is 0`);
                }
            }
            
        } catch (tokenError) {
            console.error(`   ❌ Error checking token account:`, tokenError);
        }
        
        // 4. Also check SOL balance for context
        console.log("\n4. Checking SOL balance for transaction fees...");
        const solBalance = await connection.getBalance(config.keypair.publicKey);
        const solAmount = solBalance / 1e9;
        console.log(`   💰 SOL Balance: ${solAmount.toFixed(4)} SOL`);
        
        if (solAmount < 0.01) {
            console.log(`   ⚠️  Warning: Low SOL balance for transaction fees`);
        } else {
            console.log(`   ✅ Sufficient SOL for transactions`);
        }
        
        console.log("\n🎯 Summary:");
        console.log(`   • Wallet: ${config.keypair.publicKey.toBase58()}`);
        console.log(`   • TSLAx Mint: ${tslaXMint}`);
        console.log(`   • Network: Solana Mainnet`);
        console.log(`   • Status: Ready for Kamino operations`);
        
    } catch (error) {
        console.error("❌ Balance check failed:", error);
        
        if (error instanceof Error) {
            if (error.message.includes('Invalid private key')) {
                console.log("\n🔧 Private Key Issue:");
                console.log("   • Check that SOLANA_PRIVATE_KEY is correctly set in .env");
            } else if (error.message.includes('network') || error.message.includes('connection')) {
                console.log("\n🔧 Network Issue:");
                console.log("   • Check your internet connection");
                console.log("   • Verify SOLANA_RPC_URL is accessible");
            }
        }
    }
}

// Run the balance check
checkTSLAxBalance().catch(console.error);