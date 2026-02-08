import { ethers } from "ethers";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

async function quickRPCTest() {
    console.log("⚡ Quick RPC Test for Uniswap Issue...\n");
    
    const rpcUrl = process.env.UNISWAP_RPC_URL || process.env.ETHEREUM_RPC_URL;
    const privateKey = process.env.EVM_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
    
    console.log(`🔗 Testing RPC: ${rpcUrl}`);
    console.log(`🔑 Private Key: ${privateKey ? 'Configured' : 'Missing'}`);
    
    if (!rpcUrl) {
        console.log("❌ No RPC URL configured");
        return;
    }
    
    try {
        // Test the exact same configuration as the Uniswap service
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        console.log("\n1. Testing basic connectivity...");
        const network = await provider.getNetwork();
        console.log(`   ✅ Connected to chain ID: ${network.chainId}`);
        
        console.log("\n2. Testing wallet initialization...");
        if (!privateKey) {
            console.log("   ❌ No private key configured");
            return;
        }
        
        const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`, provider);
        console.log(`   ✅ Wallet address: ${wallet.address}`);
        
        console.log("\n3. Testing the failing call: eth_getTransactionCount...");
        const txCount = await provider.getTransactionCount(wallet.address, "pending");
        console.log(`   ✅ Transaction count: ${txCount}`);
        
        console.log("\n4. Testing balance check...");
        const balance = await provider.getBalance(wallet.address);
        console.log(`   💰 ETH Balance: ${ethers.formatEther(balance)} ETH`);
        
        console.log("\n5. Testing gas estimation...");
        const gasPrice = await provider.getFeeData();
        console.log(`   ⛽ Gas Price: ${gasPrice.gasPrice ? ethers.formatUnits(gasPrice.gasPrice, 'gwei') : 'N/A'} gwei`);
        
        console.log("\n🎉 All tests passed! RPC connectivity is working.");
        console.log("\n💡 The issue might be:");
        console.log("   1. Intermittent RPC provider issues");
        console.log("   2. Rate limiting on the RPC endpoint");
        console.log("   3. Network congestion during swap execution");
        console.log("   4. Missing retry logic in the Uniswap service");
        
    } catch (error) {
        console.error("\n❌ RPC Test Failed:", error);
        
        if (error instanceof Error) {
            if (error.message.includes('no response')) {
                console.log("\n🔧 Diagnosis: RPC endpoint not responding");
                console.log("   • Try a different RPC endpoint");
                console.log("   • Implement retry logic");
                console.log("   • Add fallback RPC providers");
            } else if (error.message.includes('Unauthorized')) {
                console.log("\n🔧 Diagnosis: Authentication required");
                console.log("   • Get an API key for the RPC provider");
                console.log("   • Use a public RPC endpoint");
            } else if (error.message.includes('rate limit')) {
                console.log("\n🔧 Diagnosis: Rate limiting");
                console.log("   • Implement request throttling");
                console.log("   • Use a paid RPC service");
            }
        }
    }
}

// Run the quick test
quickRPCTest().catch(console.error);