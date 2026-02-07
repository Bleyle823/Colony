import { Plugin } from "@elizaos/core";
import { crossChainTransferAction } from "./actions/transfer";
import { sendUsdcAction } from "./actions/payment";
import { 
    createMpcWalletAction,
    getUnifiedBalanceAction,
    enableGasAbstractionAction
} from "./actions/programmableWallets";

export const circlePlugin: Plugin = {
    name: "circle",
    description: "Enhanced Circle integration with Programmable Wallets, Gateway API, Cross-Chain Transfers (BridgeKit) and Autonomous Payments",
    actions: [
        // Existing actions
        crossChainTransferAction,
        sendUsdcAction,
        // New Programmable Wallets actions
        createMpcWalletAction,
        getUnifiedBalanceAction,
        enableGasAbstractionAction,
    ],
    providers: [],
    services: []
};

export default circlePlugin;
