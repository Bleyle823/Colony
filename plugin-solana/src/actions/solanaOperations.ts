import {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  elizaLogger,
} from "@elizaos/core";
import { SolanaService } from "../services/solanaService";
import { validateSolanaConfig } from "../environment";

/**
 * SEND_SOL_USDC Action
 * 
 * Send USDC on Solana to another address
 */
export const sendSolUsdcAction: Action = {
  name: "SEND_SOL_USDC",
  similes: [
    "SEND_USDC_SOLANA",
    "TRANSFER_USDC_SOL",
    "SOLANA_USDC_TRANSFER",
    "SEND_USDC_ON_SOLANA",
  ],
  description: "Send USDC on Solana to another address",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      await validateSolanaConfig(runtime);
      return true;
    } catch (error) {
      elizaLogger.error("Solana configuration validation failed:", error);
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    elizaLogger.info("Processing Solana USDC transfer");

    try {
      const text = message.content.text;
      
      // Parse amount and recipient from message
      const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
      const addressMatch = text.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);

      if (!amountMatch || !addressMatch) {
        if (callback) {
          callback({
            text: "Please specify both amount and recipient address. Example: 'Send 100 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'",
          });
        }
        return {
          success: false,
          error: "Invalid amount or recipient address",
        };
      }

      const amount = parseFloat(amountMatch[1]);
      const toAddress = addressMatch[1];

      if (amount <= 0) {
        if (callback) {
          callback({
            text: "Amount must be greater than 0",
          });
        }
        return {
          success: false,
          error: "Invalid amount",
        };
      }

      const service = new SolanaService();
      await service.initialize(runtime);

      // Check balance first
      const balance = await service.getUsdcBalance();
      if (balance < amount) {
        if (callback) {
          callback({
            text: `Insufficient USDC balance. Available: ${balance} USDC, Requested: ${amount} USDC`,
          });
        }
        return {
          success: false,
          error: "Insufficient balance",
        };
      }

      // Execute transfer
      const signature = await service.sendUsdc(toAddress, amount);

      if (callback) {
        callback({
          text: `✅ USDC Transfer Completed on Solana!

Amount: ${amount} USDC
To: ${toAddress}
Transaction: ${signature}

The transfer has been confirmed on the Solana blockchain.`,
        });
      }

      return {
        success: true,
        text: `Sent ${amount} USDC to ${toAddress}`,
        data: {
          amount,
          toAddress,
          signature,
          blockchain: "solana",
        },
      };
    } catch (error: any) {
      elizaLogger.error("Error in Solana USDC transfer:", error);
      
      if (callback) {
        callback({
          text: `Failed to send USDC on Solana: ${error.message}`,
        });
      }

      return {
        success: false,
        error: error.message || "Unknown error in Solana transfer",
      };
    }
  },

  examples: [
    [
      {
        user: "user",
        content: { text: "Send 100 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU on Solana" },
      },
      {
        user: "treasurer",
        content: {
          text: "I'll send 100 USDC to that Solana address for you.",
        },
      },
    ],
  ],
};

/**
 * GET_SOLANA_BALANCE Action
 * 
 * Check SOL and USDC balances on Solana
 */
export const getSolanaBalanceAction: Action = {
  name: "GET_SOLANA_BALANCE",
  similes: [
    "CHECK_SOLANA_BALANCE",
    "SOLANA_WALLET_BALANCE",
    "GET_SOL_BALANCE",
    "CHECK_USDC_SOLANA",
  ],
  description: "Check SOL and USDC balances on Solana",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      await validateSolanaConfig(runtime);
      return true;
    } catch (error) {
      elizaLogger.error("Solana configuration validation failed:", error);
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    elizaLogger.info("Checking Solana balances");

    try {
      const service = new SolanaService();
      await service.initialize(runtime);

      const walletAddress = service.getWalletAddress();
      const solBalance = await service.getSolBalance();
      const usdcBalance = await service.getUsdcBalance();

      if (callback) {
        callback({
          text: `💰 Solana Wallet Balance

Address: ${walletAddress}

Balances:
• SOL: ${solBalance.toFixed(4)} SOL
• USDC: ${usdcBalance.toFixed(2)} USDC

Network: Solana Mainnet`,
        });
      }

      return {
        success: true,
        text: `SOL: ${solBalance.toFixed(4)}, USDC: ${usdcBalance.toFixed(2)}`,
        data: {
          walletAddress,
          solBalance,
          usdcBalance,
          blockchain: "solana",
        },
      };
    } catch (error: any) {
      elizaLogger.error("Error checking Solana balance:", error);
      
      if (callback) {
        callback({
          text: `Failed to check Solana balance: ${error.message}`,
        });
      }

      return {
        success: false,
        error: error.message || "Unknown error checking balance",
      };
    }
  },

  examples: [
    [
      {
        user: "user",
        content: { text: "What's my Solana balance?" },
      },
      {
        user: "treasurer",
        content: {
          text: "Let me check your SOL and USDC balances on Solana.",
        },
      },
    ],
  ],
};

/**
 * SOLANA_WALLET_OPERATIONS Action
 * 
 * General Solana wallet management operations
 */
export const solanaWalletOperationsAction: Action = {
  name: "SOLANA_WALLET_OPERATIONS",
  similes: [
    "SOLANA_WALLET_INFO",
    "GET_SOLANA_ADDRESS",
    "SOLANA_ACCOUNT_INFO",
  ],
  description: "Get Solana wallet information and perform basic operations",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      await validateSolanaConfig(runtime);
      return true;
    } catch (error) {
      elizaLogger.error("Solana configuration validation failed:", error);
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    elizaLogger.info("Processing Solana wallet operations");

    try {
      const service = new SolanaService();
      await service.initialize(runtime);

      const walletAddress = service.getWalletAddress();
      const solBalance = await service.getSolBalance();
      const usdcBalance = await service.getUsdcBalance();

      if (callback) {
        callback({
          text: `🔗 Solana Wallet Information

Address: ${walletAddress}
Network: Solana Mainnet

Current Balances:
• SOL: ${solBalance.toFixed(4)} SOL
• USDC: ${usdcBalance.toFixed(2)} USDC

This wallet can send/receive SOL and SPL tokens including USDC. It's configured for cross-chain operations with the treasury system.`,
        });
      }

      return {
        success: true,
        text: `Solana wallet: ${walletAddress}`,
        data: {
          walletAddress,
          solBalance,
          usdcBalance,
          network: "solana-mainnet",
        },
      };
    } catch (error: any) {
      elizaLogger.error("Error in Solana wallet operations:", error);
      
      if (callback) {
        callback({
          text: `Failed to get Solana wallet info: ${error.message}`,
        });
      }

      return {
        success: false,
        error: error.message || "Unknown error in wallet operations",
      };
    }
  },

  examples: [
    [
      {
        user: "user",
        content: { text: "What's my Solana wallet address?" },
      },
      {
        user: "treasurer",
        content: {
          text: "Let me get your Solana wallet information.",
        },
      },
    ],
  ],
};