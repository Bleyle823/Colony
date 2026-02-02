import { Plugin } from "@elizaos/core";
import { crossChainTransferAction } from "./actions/transfer";
import { sendUsdcAction } from "./actions/payment";

export const circlePlugin: Plugin = {
    name: "circle",
    description: "Circle integration for Cross-Chain Transfers (BridgeKit) and Autonomous Payments (Developer-Controlled Wallets)",
    actions: [
        crossChainTransferAction,
        sendUsdcAction
    ],
    providers: [],
    services: []
};

export default circlePlugin;
