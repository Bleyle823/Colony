import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { validateKaminoConfig } from "../environment.js";
import bs58 from "bs58";
import { createJupiterApiClient } from "@jup-ag/api";
import { getTokenMint } from "../constants.js";

export const buyRwaAction: Action = {
    name: "BUY_RWA",
    similes: ["SWAP_USDC_FOR_RWA", "BUY_TOKENIZED_STOCK", "SWAP_TOKENS", "BUY_TSLAX", "BUY_GOOGLX", "BUY_AMZNX", "BUY_NVDAX", "BUY_GLDX", "BUY_CRCLX", "BUY_METAX", "BUY_AAPLX"],
    description: "Swaps USDC for a target RWA token (e.g. tokenized stock TSLAx, AMZNx, NVDAx, GLDx, etc.) using Jupiter Aggregator.",
    validate: async (runtime: IAgentRuntime) => {
        try {
            const config = await validateKaminoConfig(runtime);
            const isValid = !!config.SOLANA_PRIVATE_KEY;
            if (isValid) {
                elizaLogger.log("BUY_RWA validation passed."); // Log success
            } else {
                elizaLogger.warn("BUY_RWA validation failed: Missing SOLANA_PRIVATE_KEY");
            }
            return isValid;
        } catch (e) {
            elizaLogger.warn("BUY_RWA validation failed (Action Disabled): " + (e instanceof Error ? e.message : String(e)));
            return false;
        }
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting BUY_RWA handler...");

        try {
            const config = await validateKaminoConfig(runtime);
            const connection = new Connection(config.SOLANA_RPC_URL);
            const wallet = Keypair.fromSecretKey(bs58.decode(config.SOLANA_PRIVATE_KEY));

            // Parse Input: Amount and optional Token Mint/Symbol
            const text = message.content.text;
            const amountMatch = text.match(/(\d+(\.\d+)?) (USDC|dollars)/i) || text.match(/buy (\d+(\.\d+)?)/i);

            // Extract target mint from message or config
            // Check for known symbols first
            let targetMint = config.KAMINO_RWA_MINT;

            // Check for symbols in text (e.g., TSLAx, AMZNx)
            const symbolMatch = text.match(/(TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
            if (symbolMatch) {
                const symbol = symbolMatch[0];
                const mappedMint = getTokenMint(symbol);
                if (mappedMint) {
                    targetMint = mappedMint;
                    elizaLogger.log(`Resolved symbol ${symbol} to mint ${targetMint}`);
                }
            }

            // Fallback to explicit address check
            if (!symbolMatch) {
                const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
                if (mintMatch) targetMint = mintMatch[0];
            }

            if (!amountMatch) {
                if (callback) callback({ text: "Please specify the amount of USDC to swap." });
                return false;
            }
            if (!targetMint) {
                if (callback) callback({ text: "Target RWA token mint not found. Please specify a symbol (TSLAx, GOOGLx, etc.), an address, or set KAMINO_RWA_MINT in config." });
                return false;
            }

            const amountUSDC = parseFloat(amountMatch[1]);
            const amountInLamports = Math.floor(amountUSDC * 1_000_000); // USDC has 6 decimals

            elizaLogger.log(`Swapping ${amountUSDC} USDC for ${targetMint}...`);

            // Jupiter API Client
            const jupiterQuoteApi = createJupiterApiClient();

            // 1. Get Quote
            const quote = await jupiterQuoteApi.quoteGet({
                inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC Mint
                outputMint: targetMint,
                amount: amountInLamports,
                slippageBps: 50, // 0.5%
            });

            if (!quote) {
                throw new Error("No quote found");
            }

            // 2. Get Swap Transaction
            const swapResult = await jupiterQuoteApi.swapPost({
                swapRequest: {
                    quoteResponse: quote,
                    userPublicKey: wallet.publicKey.toBase58(),
                    dynamicComputeUnitLimit: true,
                    prioritizationFeeLamports: "auto",
                },
            });

            if (!swapResult || !swapResult.swapTransaction) {
                throw new Error("Failed to generate swap transaction");
            }

            // 3. Deserialize and Sign
            const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, "base64");
            const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
            transaction.sign([wallet]);

            // 4. Execute
            const rawTransaction = transaction.serialize();
            const txid = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
                maxRetries: 2,
            });

            await connection.confirmTransaction(txid);

            elizaLogger.log(`Swap successful: ${txid}`);

            if (callback) {
                callback({
                    text: `Successfully swapped ${amountUSDC} USDC for RWA token. TX: ${txid}`,
                    content: {
                        success: true,
                        txid,
                        inputAmount: amountUSDC,
                        outputMint: targetMint
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in BUY_RWA:", error);
            if (callback) {
                callback({ text: `Swap failed: ${error instanceof Error ? error.message : String(error)}` });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Buy 100 USDC worth of RWA" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Successfully swapped 100 USDC for RWA token...",
                    action: "BUY_RWA",
                },
            },
        ],
    ],
};
