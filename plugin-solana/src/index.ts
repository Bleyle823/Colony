import { Plugin } from "@elizaos/core";
import { 
    sendSolUsdcAction,
    getSolanaBalanceAction,
    solanaWalletOperationsAction
} from "./actions/solanaOperations";
import { SolanaService } from "./services/solanaService";

export const solanaPlugin: Plugin = {
    name: "solana",
    description: "Solana blockchain integration for SOL and SPL token operations, wallet management, and cross-chain coordination",
    actions: [
        sendSolUsdcAction,
        getSolanaBalanceAction,
        solanaWalletOperationsAction,
    ],
    providers: [],
    services: [SolanaService]
};

export default solanaPlugin;
export { SolanaService } from "./services/solanaService";
export { validateSolanaConfig } from "./environment";