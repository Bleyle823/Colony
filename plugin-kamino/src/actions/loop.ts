import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { validateKaminoConfig } from "../environment.js";
import { buyRwaAction } from "./swap.js";
import { depositAction, borrowAction } from "./lending.js";
import { getTokenMint } from "../constants.js";

export const executeYieldLoopAction: Action = {
    name: "EXECUTE_YIELD_LOOP",
    similes: ["LOOP_YIELD", "LEVERAGE_UP_RWA", "BORROW_BUY_DEPOSIT_LOOP"],
    description: "Executes a leveraged yield loop: Borrow USDC -> Buy RWA (e.g. TSLAx) -> Deposit RWA. Can repeat for multiple iterations.",
    validate: async (runtime: IAgentRuntime) => {
        const config = await validateKaminoConfig(runtime);
        return !!config.SOLANA_PRIVATE_KEY;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting EXECUTE_YIELD_LOOP...");

        try {
            const config = await validateKaminoConfig(runtime);
            const text = message.content.text;
            
            // Parse parameters
            const loopsMatch = text.match(/(\d+) (times|loops)/i);
            const amountMatch = text.match(/(\d+(\.\d+)?) (USDC)/i);
            
            // Parse Symbol/Token
            let tokenSymbol = "RWA"; // Default placeholder
            const symbolMatch = text.match(/(TSLAx|CRCLx|GOOGLx|GLDx|AMZNx|NVDAx|METAx|AAPLx)/i);
            
            if (symbolMatch) {
                tokenSymbol = symbolMatch[0];
            }

            // Check if we have a mint for the symbol or default config
            let targetMint = config.KAMINO_RWA_MINT;
            if (symbolMatch) {
                const mapped = getTokenMint(tokenSymbol);
                if (mapped) targetMint = mapped;
            }

            if (!targetMint) {
                if (callback) callback({ text: "Target RWA token not identified. Please specify a symbol (TSLAx, GOOGLx) or set KAMINO_RWA_MINT." });
                return false;
            }

            const loops = loopsMatch ? parseInt(loopsMatch[1]) : 1;
            const startAmount = amountMatch ? parseFloat(amountMatch[1]) : 0;

            if (startAmount <= 0) {
                 if (callback) callback({ text: "Please specify the amount of USDC to borrow for the loop." });
                 return false;
            }

            elizaLogger.log(`Executing ${loops} loops with ${tokenSymbol} (${targetMint}), starting with borrow of ${startAmount} USDC...`);
            
            if (callback) {
                callback({ text: `Starting ${loops}x Yield Loop with ${tokenSymbol}. 1. Borrow ${startAmount} USDC...` });
            }

            let currentBorrowAmount = startAmount;

            for (let i = 1; i <= loops; i++) {
                elizaLogger.log(`--- Loop ${i}/${loops} ---`);

                // 1. Borrow
                const borrowMsg = { ...message, content: { ...message.content, text: `Borrow ${currentBorrowAmount} USDC` } };
                const borrowSuccess = await borrowAction.handler(runtime, borrowMsg, state, _options, undefined);
                if (!borrowSuccess) throw new Error(`Loop ${i}: Borrow failed.`);

                // 2. Buy RWA (with Symbol)
                // We assume we swap the borrowed USDC
                const swapMsg = { ...message, content: { ...message.content, text: `Buy ${currentBorrowAmount} USDC worth of ${tokenSymbol}` } };
                const swapSuccess = await buyRwaAction.handler(runtime, swapMsg, state, _options, undefined);
                if (!swapSuccess) throw new Error(`Loop ${i}: Swap failed.`);

                // 3. Deposit RWA (with Symbol)
                // We use the symbol so depositAction looks up the mint or config
                const depositMsg = { ...message, content: { ...message.content, text: `Deposit ${tokenSymbol}` } }; 
                
                elizaLogger.log(`Loop ${i}: Depositing ${tokenSymbol}...`);
                const depositSuccess = await depositAction.handler(runtime, depositMsg, state, _options, undefined);
                if (!depositSuccess) throw new Error(`Loop ${i}: Deposit failed.`);
                
                // Calculate next borrow amount (e.g., 70% of the value we just deposited)
                // This is an estimation. Real logic would query the new collateral value.
                currentBorrowAmount = currentBorrowAmount * 0.70; 
                
                if (callback) {
                    callback({ text: `Loop ${i} complete. Borrowed -> Swapped -> Deposited.` });
                }
            }

            if (callback) {
                callback({
                    text: `Yield Loop execution completed successfully (${loops} iterations of ${tokenSymbol}).`,
                    content: { success: true, loops, token: tokenSymbol }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in EXECUTE_YIELD_LOOP:", error);
            if (callback) callback({ text: `Yield Loop failed: ${error instanceof Error ? error.message : String(error)}` });
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Execute 3 loops with TSLAx starting with 100 USDC" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Starting 3x Yield Loop with TSLAx...",
                    action: "EXECUTE_YIELD_LOOP",
                },
            },
        ],
    ],
};
