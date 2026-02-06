import { Plugin } from "@elizaos/core";
import { transferAction } from "./actions/transfer.js";
import { getAddressAction } from "./actions/getAddress.js";
import { bridgeAction } from "./actions/bridge.js";

import { getBalanceAction } from "./actions/getBalance.js";
import { walletProvider } from "./providers/wallet.js";

export const arcPlugin: Plugin = {
    name: "arc",
    description: "Arc Network Plugin for ElizaOS",
    actions: [transferAction, getAddressAction, bridgeAction, getBalanceAction],
    evaluators: [],
    providers: [walletProvider],
};

export default arcPlugin;
