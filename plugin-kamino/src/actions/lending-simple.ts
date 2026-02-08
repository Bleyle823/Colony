import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, TransactionInstruction } from "@solana/web3.js";
import { KaminoAction, KaminoMarket, VanillaObligation, PROGRAM_ID } from "@kamino-finance/klend-sdk";
import { getOrCreateAssociatedTokenAccount, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { validateKaminoConfig } from "../environment.js";
import { getTokenMint } from "../constants.js";
import bs58 from "bs58";
import BN from "bn.js";

const MAIN_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";

// Enhanced SPL token balance checking
async function checkTokenBalance(
    runtime: IAgentRuntime,
    tokenSymbol: string,
    mintAddress?: string
): Promise<{ balance: number; formattedBalance: string; mint: string }> {
    const config = await validateKaminoConfig(runtime);
    const connection = new Connection(config.SOLANA_RPC_URL);
    const wallet = config.keypair;

    // Determine mint address
    let tokenMint = mintAddress;
    if (!tokenMint && tokenSymbol) {
        const knownMint = getTokenMint(tokenSymbol);
        if (knownMint) {
            tokenMint = knownMint;
        }
    }

    if (!tokenMint && tokenSymbol.toUpperCase() !== 'SOL') {
        throw new Error(`Could not resolve mint address for ${tokenSymbol}`);
    }

    try {
        // Handle SOL balance separately
        if (tokenSymbol.toUpperCase() === 'SOL') {
            const balance = await connection.getBalance(wallet.publicKey);
            const solBalance = balance / 1e9; // Convert lamports to SOL
            return {
                balance: solBalance,
                formattedBalance: `${solBalance.toFixed(4)} SOL`,
                mint: 'So11111111111111111111111111111111111111112' // Wrapped SOL mint
            };
        }

        // Handle SPL token balance using getTokenAccountsByOwner for better compatibility
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            wallet.publicKey,
            { mint: new PublicKey(tokenMint!) }
        );
        
        if (tokenAccounts.value.length > 0) {
            const tokenAccountData = tokenAccounts.value[0].account.data;
            const amountBytes = tokenAccountData.slice(64, 72);
            const rawAmount = Buffer.from(amountBytes).readBigUInt64LE(0);
            
            // Use correct decimals for each token
            const decimals = tokenSymbol === 'TSLAx' ? 8 : 6; // TSLAx uses 8 decimals
            balance = Number(rawAmount) / Math.pow(10, decimals);
        } else {
            balance = 0; // No token account found
        }

        return {
            balance,
            formattedBalance: `${balance.toFixed(4)} ${tokenSymbol}`,
            mint: tokenMint!
        };
    } catch (error) {
        elizaLogger.error(`Error checking balance for ${tokenSymbol}:`, error);
        // Return zero balance if account doesn't exist or other error
        return {
            balance: 0,
            formattedBalance: `0 ${tokenSymbol}`,
            mint: tokenMint!
        };
    }
}

// Custom transaction sender with proper error handling and retry logic
async function sendAndConfirmTx(
    connection: Connection,
    wallet: Keypair,
    instructions: TransactionInstruction[],
    additionalSigners: Keypair[] = [],
    lookupTables: any[] = [],
    label: string = 'transaction'
): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            elizaLogger.log(`Sending ${label} transaction (attempt ${attempt + 1}/${maxRetries}) with ${instructions.length} instructions`);
            
            // Create legacy transaction for compatibility
            const transaction = new Transaction();
            
            // Add all instructions
            transaction.add(...instructions);
            
            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;

            // Sign transaction
            transaction.sign(wallet, ...additionalSigners);

            // Send and confirm transaction with timeout
            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [wallet, ...additionalSigners],
                {
                    commitment: 'confirmed',
                    preflightCommitment: 'confirmed',
                    maxRetries: 2,
                    skipPreflight: false,
                }
            );

            elizaLogger.log(`${label} transaction confirmed: ${signature}`);
            return signature;
            
        } catch (error) {
            attempt++;
            elizaLogger.error(`${label} transaction attempt ${attempt} failed:`, error);
            
            if (attempt >= maxRetries) {
                // Provide specific error messages for common failures
                let errorMessage = `${label} transaction failed after ${maxRetries} attempts`;
                
                if (error instanceof Error) {
                    if (error.message.includes('insufficient funds') || error.message.includes('Insufficient funds')) {
                        errorMessage = `Insufficient SOL for transaction fees. Please ensure you have at least 0.01 SOL in your wallet.`;
                    } else if (error.message.includes('slippage') || error.message.includes('Slippage')) {
                        errorMessage = `Transaction failed due to slippage. Market conditions may have changed rapidly.`;
                    } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                        errorMessage = `Transaction timed out. The Solana network may be congested. Please try again in a few minutes.`;
                    } else if (error.message.includes('blockhash') || error.message.includes('Blockhash')) {
                        errorMessage = `Transaction failed due to expired blockhash. This can happen during network congestion.`;
                    } else if (error.message.includes('insufficient collateral') || error.message.includes('Insufficient collateral')) {
                        errorMessage = `Insufficient collateral for this operation. Please deposit more collateral first.`;
                    } else if (error.message.includes('borrow limit') || error.message.includes('Borrow limit')) {
                        errorMessage = `Borrow limit exceeded. You cannot borrow more than your collateral allows.`;
                    } else if (error.message.includes('reserve') || error.message.includes('Reserve')) {
                        errorMessage = `Reserve operation failed. The token reserve may be at capacity or temporarily unavailable.`;
                    } else if (error.message.includes('simulation failed')) {
                        errorMessage = `Transaction simulation failed. This usually indicates insufficient funds or invalid parameters.`;
                    } else {
                        errorMessage += `: ${error.message}`;
                    }
                }
                
                throw new Error(errorMessage);
            }
            
            // Wait before retry (exponential backoff)
            const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            elizaLogger.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    throw new Error(`${label} transaction failed after ${maxRetries} attempts`);
}

// Execute Kamino Action with real transaction execution
async function executeKaminoAction(
    runtime: IAgentRuntime,
    actionType: "deposit" | "borrow",
    amount: number,
    tokenSymbol: string,
    mintAddress?: string
): Promise<string> {
    const config = await validateKaminoConfig(runtime);
    const connection = new Connection(config.SOLANA_RPC_URL);
    const wallet = config.keypair;

    elizaLogger.log(`Executing ${actionType} for ${amount} ${tokenSymbol}`);

    // Test network connectivity first
    try {
        await connection.getSlot();
    } catch (error) {
        elizaLogger.error("Network connectivity test failed:", error);
        throw new Error("Unable to connect to Solana network. Please check your internet connection and try again.");
    }

    // Load Market with enhanced error handling
    let market;
    try {
        elizaLogger.log("Loading Kamino market...");
        market = await KaminoMarket.load(
            connection,
            new PublicKey(MAIN_MARKET)
        );
        if (!market) throw new Error("Market loaded but returned null");
        elizaLogger.log("Kamino market loaded successfully");
    } catch (error) {
        elizaLogger.error("Failed to load Kamino market:", error);
        
        if (error instanceof Error) {
            if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                throw new Error("Kamino market loading timed out. The network may be congested. Please try again.");
            } else if (error.message.includes('not found') || error.message.includes('Not found')) {
                throw new Error("Kamino market not found. The service may be temporarily unavailable.");
            } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
                throw new Error("Invalid Kamino market configuration. Please contact support.");
            }
        }
        
        throw new Error(`Failed to connect to Kamino market: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Determine Mint
    let tokenMint = mintAddress;
    if (!tokenMint && tokenSymbol) {
        const knownMint = getTokenMint(tokenSymbol);
        if (knownMint) {
            tokenMint = knownMint;
            elizaLogger.log(`Resolved ${tokenSymbol} to known RWA mint: ${tokenMint}`);
        }
    }

    if (!tokenMint) {
        const reserves = market.getReserves();
        const reserve = reserves.find((r: any) => r.symbol === tokenSymbol);
        if (!reserve) throw new Error(`Reserve for ${tokenSymbol} not found`);
        tokenMint = (reserve as any).getLiquidityMint().toString();
        elizaLogger.log(`Resolved ${tokenSymbol} via market reserve: ${tokenMint}`);
    }

    // Get user's obligations or create new one
    let obligations: any[] = [];
    try {
        // Try to get existing obligations - API may vary by SDK version
        try {
            if (typeof market.getAllUserObligations === 'function') {
                obligations = await (market as any).getAllUserObligations(wallet.publicKey.toString());
            }
        } catch (obligationError) {
            elizaLogger.warn("Alternative obligation fetch failed:", obligationError);
        }
        elizaLogger.log(`Found ${obligations.length} existing obligations for user`);
    } catch (error) {
        elizaLogger.warn("Could not fetch existing obligations, will use new obligation:", error);
        obligations = [];
    }

    // Use existing obligation or create new one
    let obligation;
    if (obligations.length > 0) {
        obligation = obligations[0];
        elizaLogger.log(`Using existing obligation: ${(obligation as any).obligationAddress?.toString() || 'existing'}`);
    } else {
        obligation = new VanillaObligation(PROGRAM_ID);
        elizaLogger.log("Using new VanillaObligation");
    }

    // Validate amount
    if (amount <= 0) {
        throw new Error(`Invalid amount: ${amount}. Amount must be positive.`);
    }

    // Convert amount to proper decimals
    const decimals = tokenSymbol === 'SOL' ? 9 : (tokenSymbol === 'TSLAx' ? 8 : 6);
    const amountInLamports = Math.floor(amount * Math.pow(10, decimals));
    
    // Check minimum amount
    const minAmount = tokenSymbol === 'SOL' ? 0.001 : 0.01;
    if (amount < minAmount) {
        throw new Error(`Amount too small. Minimum ${tokenSymbol} amount is ${minAmount}.`);
    }
    
    elizaLogger.log(`Amount: ${amount} ${tokenSymbol} = ${amountInLamports} lamports (${decimals} decimals)`);

    // Build Action
    let action: any;
    try {
        if (actionType === "deposit") {
            // Try different SDK method signatures for compatibility
            action = await (KaminoAction as any).buildDepositTxns(
                market,
                new BN(amountInLamports),
                new PublicKey(tokenMint!),
                wallet,
                obligation,
                false, // deposit into obligation
                undefined, // referrer
                300_000, // compute budget
                true // refresh reserves
            );
        } else {
            // Try different SDK method signatures for compatibility
            action = await (KaminoAction as any).buildBorrowTxns(
                market,
                new BN(amountInLamports),
                new PublicKey(tokenMint!),
                wallet,
                obligation,
                true, // borrow to wallet
                undefined // referrer
            );
        }
    } catch (error) {
        elizaLogger.error(`Failed to build ${actionType} transaction:`, error);
        
        // Provide specific error messages for common Kamino failures
        if (error instanceof Error) {
            if (error.message.includes('insufficient collateral') || error.message.includes('Insufficient collateral')) {
                throw new Error(`Insufficient collateral for ${actionType} operation. Please deposit more collateral first.`);
            } else if (error.message.includes('borrow limit') || error.message.includes('Borrow limit')) {
                throw new Error(`Borrow limit exceeded. You cannot borrow more than your collateral value allows.`);
            } else if (error.message.includes('reserve not found') || error.message.includes('Reserve not found')) {
                throw new Error(`${tokenSymbol} reserve not found on Kamino. This token may not be supported for ${actionType}.`);
            } else if (error.message.includes('market not found') || error.message.includes('Market not found')) {
                throw new Error(`Unable to connect to Kamino market. Please check your network connection and try again.`);
            } else if (error.message.includes('obligation not found') || error.message.includes('Obligation not found')) {
                throw new Error(`User obligation not found. You may need to deposit collateral first before borrowing.`);
            } else if (error.message.includes('reserve capacity') || error.message.includes('Reserve capacity')) {
                throw new Error(`${tokenSymbol} reserve is at capacity. Please try again later or use a different token.`);
            } else if (error.message.includes('liquidation threshold') || error.message.includes('Liquidation threshold')) {
                throw new Error(`Operation would put your position at risk of liquidation. Please reduce the amount or add more collateral.`);
            }
        }
        
        throw new Error(`Failed to build ${actionType} transaction: ${error instanceof Error ? error.message : String(error)}`);
    }

    elizaLogger.log("Built Kamino action, executing transaction...");

    // Execute the transaction
    try {
        // Extract instructions from the action object
        const instructions = [
            ...action.computeBudgetIxs,
            ...action.setupIxs,
            ...action.lendingIxs,
            ...action.cleanupIxs,
        ];
        
        const signature = await sendAndConfirmTx(
            connection,
            wallet,
            instructions,
            [],
            [],
            actionType
        );
        
        elizaLogger.log(`${actionType} transaction completed: ${signature}`);
        return signature;
        
    } catch (error) {
        elizaLogger.error("Transaction failed:", error);
        
        // Provide specific error messages for common failures
        let errorMessage = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} transaction failed`;
        
        if (error instanceof Error) {
            if (error.message.includes('insufficient funds')) {
                errorMessage = `Insufficient SOL for transaction fees. Please ensure you have enough SOL in your wallet.`;
            } else if (error.message.includes('slippage')) {
                errorMessage = `Transaction failed due to slippage. Market conditions may have changed.`;
            } else if (error.message.includes('timeout')) {
                errorMessage = `Transaction timed out. Network may be congested. Please try again.`;
            } else if (error.message.includes('blockhash')) {
                errorMessage = `Transaction failed due to expired blockhash. Please try again.`;
            } else {
                errorMessage += `: ${error.message}`;
            }
        }
        
        throw new Error(errorMessage);
    }
}

export const depositAction: Action = {
    name: "DEPOSIT_ON_KAMINO",
    similes: ["DEPOSIT_COLLATERAL", "SUPPLY_ASSETS"],
    description: "Deposit assets (USDC, SOL, Tesla xStock/TSLAx) into Kamino Lending to use as collateral.",
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
        elizaLogger.log("Starting DEPOSIT_ON_KAMINO...");
        try {
            const text = message.content.text;
            const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|SOL|RWA|TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i) || text.match(/deposit (\d+(\.\d+)?)/i);
            const symbolMatch = text.match(/(USDC|SOL|RWA|TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
            
            if (!amountMatch) {
                if (callback) callback({ text: "Please specify amount to deposit (e.g., 'Deposit 50 TSLAx')." });
                return false;
            }

            const amount = parseFloat(amountMatch[1]);
            const symbol = symbolMatch ? symbolMatch[0].toUpperCase() : "USDC";

            // Validate deposit amount
            if (amount <= 0) {
                if (callback) callback({ text: "Deposit amount must be positive." });
                return false;
            }
            
            // Set minimum amounts based on token type
            const minAmount = symbol === 'SOL' ? 0.001 : 0.01;
            if (amount < minAmount) {
                if (callback) callback({ text: `Minimum ${symbol} deposit amount is ${minAmount}.` });
                return false;
            }

            // Get token mint
            let mint = getTokenMint(symbol);
            if (!mint && symbol !== 'SOL') {
                if (callback) callback({ text: `Token ${symbol} not supported or mint not found.` });
                return false;
            }

            // Check balance before depositing
            elizaLogger.log(`Checking balance before depositing ${amount} ${symbol}...`);
            const balanceInfo = await checkTokenBalance(runtime, symbol, mint);
            
            if (balanceInfo.balance < amount) {
                const errorMsg = `Insufficient ${symbol} balance. You have ${balanceInfo.formattedBalance} but need ${amount} ${symbol}.`;
                elizaLogger.error(errorMsg);
                if (callback) callback({ text: errorMsg });
                return false;
            }

            elizaLogger.log(`Balance check passed. Available: ${balanceInfo.formattedBalance}, Depositing: ${amount} ${symbol}`);
            
            // Execute the deposit transaction
            const signature = await executeKaminoAction(runtime, "deposit", amount, symbol, mint);

            if (callback) {
                callback({
                    text: `✅ Successfully deposited ${amount} ${symbol} to Kamino!\n\nTransaction: https://solscan.io/tx/${signature}`,
                    content: { 
                        success: true, 
                        signature, 
                        amount, 
                        symbol,
                        mint: balanceInfo.mint,
                        explorerUrl: `https://solscan.io/tx/${signature}`,
                        action: "deposit_completed"
                    }
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in DEPOSIT:", error);
            if (callback) callback({ text: `Deposit failed: ${error instanceof Error ? error.message : String(error)}` });
            return false;
        }
    },
    examples: [
        [{ user: "{{user1}}", content: { text: "Deposit 50 TSLAx" } }, { user: "{{agentName}}", content: { text: "Depositing 50 TSLAx to Kamino...", action: "DEPOSIT_ON_KAMINO" } }],
        [{ user: "{{user1}}", content: { text: "Deposit 100 USDC as collateral" } }, { user: "{{agentName}}", content: { text: "Depositing 100 USDC as collateral...", action: "DEPOSIT_ON_KAMINO" } }]
    ]
};

export const borrowAction: Action = {
    name: "BORROW_USDC_ON_KAMINO",
    similes: ["BORROW_USDC", "TAKE_LOAN"],
    description: "Borrow USDC from Kamino Lending against deposited collateral.",
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
        elizaLogger.log("Starting BORROW_USDC_ON_KAMINO...");
        try {
            const text = message.content.text;
            const amountMatch = text.match(/(\d+(\.\d+)?) (USDC)/i) || text.match(/borrow (\d+(\.\d+)?)/i);
            
            if (!amountMatch) {
                if (callback) callback({ text: "Please specify amount of USDC to borrow (e.g., 'Borrow 100 USDC')." });
                return false;
            }

            const amount = parseFloat(amountMatch[1]);
            
            // Validate borrow amount
            if (amount <= 0) {
                if (callback) callback({ text: "Borrow amount must be positive." });
                return false;
            }
            
            if (amount < 1) {
                if (callback) callback({ text: "Minimum borrow amount is 1 USDC." });
                return false;
            }
            
            elizaLogger.log(`Borrowing ${amount} USDC...`);
            
            // Execute the borrow transaction
            const signature = await executeKaminoAction(runtime, "borrow", amount, "USDC");

            if (callback) {
                callback({
                    text: `✅ Successfully borrowed ${amount} USDC from Kamino!\n\nTransaction: https://solscan.io/tx/${signature}`,
                    content: { 
                        success: true, 
                        signature, 
                        amount,
                        symbol: "USDC",
                        explorerUrl: `https://solscan.io/tx/${signature}`,
                        action: "borrow_completed"
                    }
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in BORROW:", error);
            if (callback) callback({ text: `Borrow failed: ${error instanceof Error ? error.message : String(error)}` });
            return false;
        }
    },
    examples: [
        [{ user: "{{user1}}", content: { text: "Borrow 20 USDC" } }, { user: "{{agentName}}", content: { text: "Borrowing 20 USDC from Kamino...", action: "BORROW_USDC_ON_KAMINO" } }]
    ]
};
