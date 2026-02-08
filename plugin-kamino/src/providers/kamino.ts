import { Connection, PublicKey } from "@solana/web3.js";
import { KaminoMarket, KaminoObligation, VanillaObligation } from "@kamino-finance/klend-sdk";
import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";
import { validateKaminoConfig } from "../environment.js";
import bs58 from "bs58";

export class KaminoProvider {
    private connection: Connection;
    private market: KaminoMarket | null = null;
    private walletPublicKey: PublicKey;

    constructor(rpcUrl: string, privateKey: string) {
        this.connection = new Connection(rpcUrl);
        const secretKey = bs58.decode(privateKey);
        // Derive public key from private key (simplified for ed25519)
        // In a real scenario, use Keypair.fromSecretKey(secretKey).publicKey
        // But for provider logic, we assume we can construct it or pass it.
        // Let's use a dummy or derive properly if we import Keypair.
        // Since we didn't import Keypair from web3.js in the imports above, let's fix that.
        // Or better, just store the keypair if needed, but for now we need the public key.
        // We will do lazy loading in init() usually.
        // For this constructor, let's just assume we will derive it in methods or use a helper.
        // Actually, let's import Keypair.
        
        // Dynamic import or assumed import (Keypair is standard in @solana/web3.js)
        const { Keypair } = require("@solana/web3.js");
        this.walletPublicKey = Keypair.fromSecretKey(secretKey).publicKey;
    }

    async init() {
        if (!this.market) {
            // Load Main Market by default
            this.market = await KaminoMarket.load(
                this.connection,
                new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF") // Main Market
            );
        }
    }

    async getMarket(): Promise<KaminoMarket> {
        await this.init();
        if (!this.market) throw new Error("Failed to load Kamino Market");
        return this.market;
    }

    async getObligation(): Promise<KaminoObligation | null> {
        const market = await this.getMarket();
        // Kamino SDK uses obligations to track user positions
        // We need to fetch the obligation for the user's wallet
        try {
            // Check if user has an obligation
            // This is a simplified call; actual SDK might require finding the obligation address first
            // or using a helper like market.getUserObligations(userPk)
            
            // Note: The SDK method names might vary slightly by version.
            // Using a common pattern:
            const obligations = await market.getAllUserObligations(this.walletPublicKey);
            
            if (obligations && obligations.length > 0) {
                // Return the first one for now (assuming single main account usage)
                return obligations[0];
            }
            return null;
        } catch (error) {
            elizaLogger.error("Error fetching Kamino obligation", error);
            return null;
        }
    }

    async getPortfolioStats() {
        const obligation = await this.getObligation();
        if (!obligation) {
            return {
                hasPosition: false,
                ltv: 0,
                depositedValue: 0,
                borrowedValue: 0,
                netValue: 0
            };
        }

        // Calculate stats from obligation
        // Assuming obligation has computed stats or we need to calculate them
        // The SDK usually provides processed stats in the obligation object or via helpers.
        
        // stats.loanToValue is typically 0-1 or 0-100
        const stats = obligation.refreshedStats; 
        
        return {
            hasPosition: true,
            ltv: stats.loanToValue,
            depositedValue: stats.userTotalDeposit.toNumber(),
            borrowedValue: stats.userTotalBorrow.toNumber(),
            netValue: stats.userTotalDeposit.sub(stats.userTotalBorrow).toNumber()
        };
    }
}

export const kaminoProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        try {
            const config = await validateKaminoConfig(runtime);
            const provider = new KaminoProvider(config.SOLANA_RPC_URL, config.SOLANA_PRIVATE_KEY);
            
            const stats = await provider.getPortfolioStats();
            
            if (!stats.hasPosition) {
                return "Kamino Portfolio: No active positions found.";
            }

            return `Kamino Portfolio Stats:
- LTV: ${(stats.ltv * 100).toFixed(2)}%
- Total Deposited: $${stats.depositedValue.toFixed(2)}
- Total Borrowed: $${stats.borrowedValue.toFixed(2)}
- Net Value: $${stats.netValue.toFixed(2)}`;
        } catch (error) {
            return `Error fetching Kamino stats: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
    },
};
