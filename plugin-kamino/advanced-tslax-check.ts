import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { validateKaminoConfig } from "./src/environment.js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

// Mock runtime for testing
const mockRuntime = {
    getSetting: (key: string) => process.env[key],
};

async function advancedTSLAxCheck() {
    console.log("🔬 Advanced TSLAx Balance Check Using Multiple Techniques...\n");
    
    const tslaXMint = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
    
    try {
        // 1. Validate configuration
        console.log("1. Validating wallet configuration...");
        const config = await validateKaminoConfig(mockRuntime as any);
        const walletPubkey = config.keypair.publicKey;
        console.log(`   ✅ Wallet: ${walletPubkey.toBase58()}`);
        
        // 2. Connect to Solana with multiple RPC endpoints for redundancy
        console.log("\n2. Connecting to Solana...");
        const rpcEndpoints = [
            config.SOLANA_RPC_URL,
            "https://api.mainnet-beta.solana.com",
            "https://solana-api.projectserum.com",
            "https://rpc.ankr.com/solana"
        ];
        
        let connection: Connection | null = null;
        for (const rpc of rpcEndpoints) {
            try {
                const testConnection = new Connection(rpc, 'confirmed');
                await testConnection.getSlot();
                connection = testConnection;
                console.log(`   ✅ Connected to: ${rpc}`);
                break;
            } catch (rpcError) {
                console.log(`   ⚠️  Failed to connect to: ${rpc}`);
            }
        }
        
        if (!connection) {
            throw new Error("Could not connect to any Solana RPC endpoint");
        }
        
        // 3. Method 1: Direct account info check
        console.log("\n3. Method 1: Direct account info check...");
        try {
            const associatedTokenAddress = await getAssociatedTokenAddress(
                new PublicKey(tslaXMint),
                walletPubkey
            );
            
            console.log(`   📍 Associated Token Account: ${associatedTokenAddress.toBase58()}`);
            
            const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
            
            if (accountInfo) {
                console.log(`   ✅ Account exists!`);
                console.log(`   📊 Account data length: ${accountInfo.data.length} bytes`);
                console.log(`   👤 Owner: ${accountInfo.owner.toBase58()}`);
                
                // Parse token account data manually
                if (accountInfo.data.length === 165) { // Standard token account size
                    const mintBytes = accountInfo.data.slice(0, 32);
                    const ownerBytes = accountInfo.data.slice(32, 64);
                    const amountBytes = accountInfo.data.slice(64, 72);
                    
                    const mint = new PublicKey(mintBytes).toBase58();
                    const owner = new PublicKey(ownerBytes).toBase58();
                    const amount = Buffer.from(amountBytes).readBigUInt64LE(0);
                    
                    console.log(`   🏷️  Mint: ${mint}`);
                    console.log(`   👤 Owner: ${owner}`);
                    console.log(`   💰 Raw Amount: ${amount.toString()}`);
                    
                    if (mint === tslaXMint) {
                        const balance = Number(amount) / Math.pow(10, 6); // 6 decimals for TSLAx
                        console.log(`   🚗 TSLAx Balance: ${balance.toFixed(6)} TSLAx`);
                        
                        if (balance > 0) {
                            console.log(`   🎉 SUCCESS: Found ${balance} TSLAx!`);
                        }
                    }
                }
            } else {
                console.log(`   ℹ️  Associated token account does not exist`);
            }
        } catch (method1Error) {
            console.error(`   ❌ Method 1 failed:`, method1Error);
        }
        
        // 4. Method 2: getProgramAccounts to find all token accounts
        console.log("\n4. Method 2: Scanning all token accounts via getProgramAccounts...");
        try {
            const tokenAccounts = await connection.getProgramAccounts(
                TOKEN_PROGRAM_ID,
                {
                    filters: [
                        {
                            dataSize: 165, // Token account data size
                        },
                        {
                            memcmp: {
                                offset: 32, // Owner field offset
                                bytes: walletPubkey.toBase58(),
                            },
                        },
                    ],
                }
            );
            
            console.log(`   📊 Found ${tokenAccounts.length} token accounts owned by wallet`);
            
            let tslaXFound = false;
            
            for (let i = 0; i < tokenAccounts.length; i++) {
                const account = tokenAccounts[i];
                const data = account.account.data;
                
                // Parse token account data
                const mintBytes = data.slice(0, 32);
                const ownerBytes = data.slice(32, 64);
                const amountBytes = data.slice(64, 72);
                
                const mint = new PublicKey(mintBytes).toBase58();
                const owner = new PublicKey(ownerBytes).toBase58();
                const amount = Buffer.from(amountBytes).readBigUInt64LE(0);
                
                console.log(`   ${i + 1}. Account: ${account.pubkey.toBase58()}`);
                console.log(`      Mint: ${mint}`);
                console.log(`      Owner: ${owner}`);
                console.log(`      Raw Amount: ${amount.toString()}`);
                
                if (mint === tslaXMint) {
                    tslaXFound = true;
                    const balance = Number(amount) / Math.pow(10, 6);
                    console.log(`      🚗 THIS IS TSLAx! Balance: ${balance.toFixed(6)} TSLAx`);
                    
                    if (balance > 0) {
                        console.log(`      🎉 SUCCESS: Found ${balance} TSLAx in account ${account.pubkey.toBase58()}!`);
                        
                        // Calculate borrowing power
                        const estimatedBorrowPower = balance * 0.7;
                        console.log(`      📊 Estimated borrowing power: ~${estimatedBorrowPower.toFixed(2)} USDC (at 70% LTV)`);
                        
                        console.log(`\n      🚀 Ready for Kamino operations:`);
                        console.log(`         • Deposit: "Deposit ${balance.toFixed(2)} TSLAx"`);
                        console.log(`         • Borrow: "Borrow ${estimatedBorrowPower.toFixed(0)} USDC"`);
                    }
                }
                console.log("");
            }
            
            if (!tslaXFound) {
                console.log(`   ⚠️  No TSLAx accounts found via getProgramAccounts`);
            }
            
        } catch (method2Error) {
            console.error(`   ❌ Method 2 failed:`, method2Error);
        }
        
        // 5. Method 3: Check mint supply and holders (if accessible)
        console.log("\n5. Method 3: Checking TSLAx mint information...");
        try {
            const mintInfo = await connection.getAccountInfo(new PublicKey(tslaXMint));
            
            if (mintInfo) {
                console.log(`   ✅ TSLAx mint exists on-chain`);
                console.log(`   📊 Mint account size: ${mintInfo.data.length} bytes`);
                console.log(`   👤 Mint authority: ${mintInfo.owner.toBase58()}`);
                
                // Parse mint data to get supply info
                if (mintInfo.data.length >= 82) {
                    const supplyBytes = mintInfo.data.slice(36, 44);
                    const decimals = mintInfo.data[44];
                    const supply = Buffer.from(supplyBytes).readBigUInt64LE(0);
                    
                    console.log(`   🔢 Total Supply: ${Number(supply) / Math.pow(10, decimals)} TSLAx`);
                    console.log(`   🔢 Decimals: ${decimals}`);
                }
            } else {
                console.log(`   ❌ TSLAx mint does not exist on-chain!`);
            }
        } catch (method3Error) {
            console.error(`   ❌ Method 3 failed:`, method3Error);
        }
        
        // 6. Method 4: Use getTokenAccountsByOwner with mint filter
        console.log("\n6. Method 4: getTokenAccountsByOwner with mint filter...");
        try {
            const tokenAccountsByMint = await connection.getTokenAccountsByOwner(
                walletPubkey,
                {
                    mint: new PublicKey(tslaXMint)
                }
            );
            
            console.log(`   📊 Found ${tokenAccountsByMint.value.length} TSLAx accounts`);
            
            if (tokenAccountsByMint.value.length > 0) {
                for (let i = 0; i < tokenAccountsByMint.value.length; i++) {
                    const account = tokenAccountsByMint.value[i];
                    const data = account.account.data;
                    
                    // Parse amount from token account
                    const amountBytes = data.slice(64, 72);
                    const amount = Buffer.from(amountBytes).readBigUInt64LE(0);
                    const balance = Number(amount) / Math.pow(10, 6);
                    
                    console.log(`   ${i + 1}. TSLAx Account: ${account.pubkey.toBase58()}`);
                    console.log(`      Balance: ${balance.toFixed(6)} TSLAx`);
                    
                    if (balance > 0) {
                        console.log(`      🎉 FOUND TSLAx BALANCE: ${balance} TSLAx!`);
                    }
                }
            } else {
                console.log(`   ℹ️  No TSLAx token accounts found for this wallet`);
            }
            
        } catch (method4Error) {
            console.error(`   ❌ Method 4 failed:`, method4Error);
        }
        
        // 7. Summary
        console.log("\n🎯 Advanced Check Summary:");
        console.log(`   • Wallet: ${walletPubkey.toBase58()}`);
        console.log(`   • TSLAx Mint: ${tslaXMint}`);
        console.log(`   • Network: Solana Mainnet`);
        console.log(`   • Methods Used: 4 different balance checking techniques`);
        
        console.log("\n🔗 External Verification:");
        console.log(`   • Solscan: https://solscan.io/account/${walletPubkey.toBase58()}`);
        console.log(`   • Solana Explorer: https://explorer.solana.com/address/${walletPubkey.toBase58()}`);
        console.log(`   • TSLAx Mint: https://solscan.io/token/${tslaXMint}`);
        
    } catch (error) {
        console.error("❌ Advanced check failed:", error);
    }
}

// Run the advanced check
advancedTSLAxCheck().catch(console.error);