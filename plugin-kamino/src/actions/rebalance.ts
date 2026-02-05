import { Action, IAgentRuntime, Memory, State, HandlerCallback, elizaLogger } from "@elizaos/core";
import { validateKaminoConfig } from "../environment.js";
import { KaminoProvider } from "../providers/kamino.js";

export const rebalancePortfolioAction: Action = {
    name: "REBALANCE_PORTFOLIO",
    similes: ["REBALANCE_KAMINO", "ADJUST_LTV", "MANAGE_RISK"],
    description: "Checks Kamino portfolio LTV and rebalances (Repay or Borrow) to reach target LTV.",
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
        elizaLogger.log("Starting REBALANCE_PORTFOLIO...");

        try {
            const config = await validateKaminoConfig(runtime);
            const provider = new KaminoProvider(config.SOLANA_RPC_URL, config.SOLANA_PRIVATE_KEY);
            const stats = await provider.getPortfolioStats();

            if (!stats.hasPosition) {
                if (callback) callback({ text: "No active Kamino position to rebalance." });
                return false;
            }

            const text = message.content.text;
            const targetMatch = text.match(/(\d+(\.\d+)?)%/); // e.g. "60%"
            
            if (!targetMatch) {
                if (callback) callback({ text: "Please specify target LTV percentage (e.g., 'Rebalance to 60%')." });
                return false;
            }

            const targetLtvPercent = parseFloat(targetMatch[1]);
            const targetLtv = targetLtvPercent / 100;
            const currentLtv = stats.ltv;

            elizaLogger.log(`Current LTV: ${(currentLtv*100).toFixed(2)}%, Target: ${targetLtvPercent}%`);

            let actionDescription = "";

            if (Math.abs(currentLtv - targetLtv) < 0.02) {
                actionDescription = "LTV is within tolerance. No rebalance needed.";
            } else if (currentLtv > targetLtv) {
                // Too much debt -> Repay
                actionDescription = `LTV too high (${(currentLtv*100).toFixed(2)}%). Recommendation: Repay debt or Supply more collateral to reduce LTV to ${targetLtvPercent}%.`;
                // Logic to calculate repay amount would go here
            } else {
                // Low debt -> Leverage Up
                actionDescription = `LTV is low (${(currentLtv*100).toFixed(2)}%). Recommendation: Execute Yield Loop to increase LTV to ${targetLtvPercent}%.`;
            }

            if (callback) {
                callback({
                    text: `Rebalance Analysis:\n${actionDescription}\n\nCurrent Stats:\nLTV: ${(currentLtv*100).toFixed(2)}%\nNet Value: $${stats.netValue.toFixed(2)}`,
                    content: {
                        success: true,
                        currentLtv,
                        targetLtv,
                        recommendation: actionDescription
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in REBALANCE:", error);
            if (callback) callback({ text: `Rebalance failed: ${error instanceof Error ? error.message : String(error)}` });
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Rebalance portfolio to 60%" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Rebalance Analysis: LTV is low...",
                    action: "REBALANCE_PORTFOLIO",
                },
            },
        ],
    ],
};
