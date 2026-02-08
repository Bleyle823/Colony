import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { Connection, PublicKey } from "@solana/web3.js";
import { validateKaminoConfig } from "../environment.js";
import { getTokenMint } from "../constants.js";

// Comprehensive balance checking for multiple tokens
async function checkMultipleBalances(
    runtime: IAgentRuntime,
    tokens: string[]
): Promise<Array<{ symbol: string; balance: number; formattedBalance: string; mint: string; usdValue?: number }>> {
    const config = await validateKaminoConfig(runtime);
    const connection = new Connection(config.SOLANA_RPC_URL);
    const wallet = config.keypair;
    
    elizaLogger.log(`Checking balances for wallet: ${wallet.publicKey.toBase58()}`);
    
    const results = [];
    
    for (const tokenSymbol of tokens) {
        try {
            let tokenMint: string | undefined;
            let balance = 0;
            let formattedBalance = `0 ${tokenSymbol}`;
            
            // Handle SOL balance separately
            if (tokenSymbol.toUpperCase() === 'SOL') {
                const solBalance = await connection.getBalance(wallet.publicKey);
                balance = solBalance / 1e9; // Convert lamports to SOL
                formattedBalance = `${balance.toFixed(4)} SOL`;
                tokenMint = 'So11111111111111111111111111111111111111112'; // Wrapped SOL mint
            } else {
                // Handle SPL token balance
                tokenMint = getTokenMint(tokenSymbol);
                
                if (!tokenMint) {
                    elizaLogger.warn(`No mint address found for ${tokenSymbol}`);
                    results.push({
                        symbol: tokenSymbol,
                        balance: 0,
                        formattedBalance: `0 ${tokenSymbol} (not supported)`,
                        mint: 'unknown'
                    });
                    continue;
                }
                
                try {
                    // Use getTokenAccountsByOwner to find all accounts for this mint
                    const tokenAccounts = await connection.getTokenAccountsByOwner(
                        wallet.publicKey,
                        { mint: new PublicKey(tokenMint) }
                    );
                    
                    if (tokenAccounts.value.length > 0) {
                        // Use the first account found (there should typically be only one)
                        const tokenAccountData = tokenAccounts.value[0].account.data;
                        
                        // Parse amount from token account data
                        const amountBytes = tokenAccountData.slice(64, 72);
                        const rawAmount = Buffer.from(amountBytes).readBigUInt64LE(0);
                        
                        // Use correct decimals for each token
                        const decimals = tokenSymbol === 'TSLAx' ? 8 : 6; // TSLAx uses 8 decimals, others use 6
                        balance = Number(rawAmount) / Math.pow(10, decimals);
                        formattedBalance = `${balance.toFixed(6)} ${tokenSymbol}`;
                        
                        elizaLogger.log(`Found ${tokenSymbol} in account: ${tokenAccounts.value[0].pubkey.toBase58()}`);
                    } else {
                        // No token accounts found for this mint
                        balance = 0;
                        formattedBalance = `0 ${tokenSymbol}`;
                    }
                } catch (tokenError) {
                    elizaLogger.warn(`Error checking ${tokenSymbol} balance:`, tokenError);
                    // Fallback to 0 balance
                    balance = 0;
                    formattedBalance = `0 ${tokenSymbol}`;
                }
            }
            
            results.push({
                symbol: tokenSymbol,
                balance,
                formattedBalance,
                mint: tokenMint || 'unknown'
            });
            
        } catch (error) {
            elizaLogger.error(`Error checking balance for ${tokenSymbol}:`, error);
            results.push({
                symbol: tokenSymbol,
                balance: 0,
                formattedBalance: `0 ${tokenSymbol} (error)`,
                mint: 'error'
            });
        }
    }
    
    return results;
}

export const checkAllBalancesAction: Action = {
    name: "CHECK_ALL_BALANCES",
    similes: ["CHECK_BALANCES", "SHOW_ALL_BALANCES", "GET_ALL_BALANCES", "WALLET_BALANCE"],
    description: "Check balances for SOL, TSLAx, and other supported tokens in the wallet.",
    validate: async (runtime: IAgentRuntime) => {
        try {
            const config = await validateKaminoConfig(runtime);
            return !!config.keypair;
        } catch (error) {
            elizaLogger.error("Validation failed:", error);
            return false;
        }
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: any, callback?: HandlerCallback) => {
        elizaLogger.log("Starting CHECK_ALL_BALANCES...");
        try {
            const text = message.content.text.toLowerCase();
            
            // Determine which tokens to check based on the message
            let tokensToCheck = ['SOL', 'TSLAx']; // Default tokens
            
            // Check if specific tokens are mentioned
            const allSupportedTokens = ['SOL', 'USDC', 'TSLAx', 'CRCLx', 'GOOGLx', 'GLDx', 'AMZNx', 'NVDAx', 'METAx', 'AAPLx'];
            const mentionedTokens = allSupportedTokens.filter(token => 
                text.includes(token.toLowerCase())
            );
            
            if (mentionedTokens.length > 0) {
                tokensToCheck = mentionedTokens;
            } else if (text.includes('all') || text.includes('everything')) {
                tokensToCheck = allSupportedTokens;
            }
            
            elizaLogger.log(`Checking balances for tokens: ${tokensToCheck.join(', ')}`);
            
            const balances = await checkMultipleBalances(runtime, tokensToCheck);
            
            // Format the response
            let responseText = "💰 **Wallet Balances:**\n\n";
            let hasNonZeroBalance = false;
            
            for (const balance of balances) {
                const emoji = balance.symbol === 'SOL' ? '◎' : 
                             balance.symbol === 'TSLAx' ? '🚗' :
                             balance.symbol === 'USDC' ? '💵' : '🪙';
                
                responseText += `${emoji} ${balance.formattedBalance}\n`;
                
                if (balance.balance > 0) {
                    hasNonZeroBalance = true;
                }
            }
            
            if (!hasNonZeroBalance) {
                responseText += "\n⚠️ No tokens found in wallet. Make sure you have funded your wallet.";
            } else {
                // Add helpful information about using TSLAx as collateral
                const tslaBalance = balances.find(b => b.symbol === 'TSLAx');
                if (tslaBalance && tslaBalance.balance > 0) {
                    responseText += `\n✅ You can use your ${tslaBalance.formattedBalance} as collateral to borrow USDC on Kamino!`;
                }
            }
            
            const config = await validateKaminoConfig(runtime);
            responseText += `\n\n🔑 Wallet Address: \`${config.keypair.publicKey.toBase58()}\``;

            if (callback) {
                callback({
                    text: responseText,
                    content: { 
                        success: true, 
                        balances,
                        walletAddress: config.keypair.publicKey.toBase58(),
                        action: "all_balances_checked"
                    }
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error checking all balances:", error);
            if (callback) {
                callback({ 
                    text: `Balance check failed: ${error instanceof Error ? error.message : String(error)}` 
                });
            }
            return false;
        }
    },
    examples: [
        [{ user: "{{user1}}", content: { text: "Check my balances" } }, { user: "{{agentName}}", content: { text: "Checking your wallet balances...", action: "CHECK_ALL_BALANCES" } }],
        [{ user: "{{user1}}", content: { text: "Show my SOL and TSLAx balance" } }, { user: "{{agentName}}", content: { text: "Checking SOL and TSLAx balances...", action: "CHECK_ALL_BALANCES" } }],
        [{ user: "{{user1}}", content: { text: "What's in my wallet?" } }, { user: "{{agentName}}", content: { text: "Checking all your token balances...", action: "CHECK_ALL_BALANCES" } }]
    ]
};

export const checkSingleBalanceAction: Action = {
    name: "CHECK_SINGLE_BALANCE",
    similes: ["CHECK_BALANCE", "SHOW_BALANCE", "GET_BALANCE", "BALANCE_CHECK"],
    description: "Check the balance of a specific token (SOL, TSLAx, USDC, etc.).",
    validate: async (runtime: IAgentRuntime) => {
        try {
            const config = await validateKaminoConfig(runtime);
            return !!config.keypair;
        } catch (error) {
            elizaLogger.error("Validation failed:", error);
            return false;
        }
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state: State, _options: any, callback?: HandlerCallback) => {
        elizaLogger.log("Starting CHECK_SINGLE_BALANCE...");
        try {
            const text = message.content.text;
            const symbolMatch = text.match(/(USDC|SOL|TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
            
            if (!symbolMatch) {
                if (callback) callback({ text: "Please specify which token balance to check (e.g., 'Check my TSLAx balance')." });
                return false;
            }

            const symbol = symbolMatch[0].toUpperCase();
            elizaLogger.log(`Checking balance for ${symbol}...`);
            
            const balances = await checkMultipleBalances(runtime, [symbol]);
            const balance = balances[0];

            let responseText = `💰 Your ${balance.symbol} balance: ${balance.formattedBalance}`;
            
            // Add helpful context for TSLAx
            if (symbol === 'TSLAx' && balance.balance > 0) {
                responseText += `\n\n✅ You can use this TSLAx as collateral to borrow USDC on Kamino!`;
                responseText += `\nTo deposit as collateral: "Deposit ${balance.balance} TSLAx"`;
            }
            
            // Add helpful context for SOL
            if (symbol === 'SOL') {
                if (balance.balance < 0.01) {
                    responseText += `\n\n⚠️ Low SOL balance! You need SOL for transaction fees.`;
                } else {
                    responseText += `\n\n✅ Sufficient SOL for transaction fees.`;
                }
            }

            if (callback) {
                callback({
                    text: responseText,
                    content: { 
                        success: true, 
                        symbol: balance.symbol, 
                        balance: balance.balance,
                        formattedBalance: balance.formattedBalance,
                        mint: balance.mint,
                        action: "single_balance_checked"
                    }
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error checking balance:", error);
            if (callback) callback({ text: `Balance check failed: ${error instanceof Error ? error.message : String(error)}` });
            return false;
        }
    },
    examples: [
        [{ user: "{{user1}}", content: { text: "Check my TSLAx balance" } }, { user: "{{agentName}}", content: { text: "Checking TSLAx balance...", action: "CHECK_SINGLE_BALANCE" } }],
        [{ user: "{{user1}}", content: { text: "What's my SOL balance?" } }, { user: "{{agentName}}", content: { text: "Checking SOL balance...", action: "CHECK_SINGLE_BALANCE" } }],
        [{ user: "{{user1}}", content: { text: "Show USDC balance" } }, { user: "{{agentName}}", content: { text: "Checking USDC balance...", action: "CHECK_SINGLE_BALANCE" } }]
    ]
};