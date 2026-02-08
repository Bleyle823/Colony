// @ts-ignore
import { Plugin } from "@elizaos/core";
import { buyRwaAction } from "./actions/swap.js";
import { depositAction, borrowAction } from "./actions/lending.js";
import { executeYieldLoopAction } from "./actions/loop.js";
import { rebalancePortfolioAction } from "./actions/rebalance.js";
import { kaminoProvider } from "./providers/kamino.js";

export const kaminoPlugin: Plugin = {
    name: "kamino",
    description: "Kamino Finance Plugin for Leveraged Yield Looping and Portfolio Rebalancing.",
    actions: [
        buyRwaAction,
        depositAction,
        borrowAction,
        executeYieldLoopAction,
        rebalancePortfolioAction
    ],
    providers: [kaminoProvider],
};

export default kaminoPlugin;
