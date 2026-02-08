// @ts-ignore
import { Plugin } from "@elizaos/core";
import { buyRwaAction } from "./actions/swap.js";
import { depositAction, borrowAction } from "./actions/lending-simple.js";
import { checkAllBalancesAction, checkSingleBalanceAction } from "./actions/balance-checker.js";
import { executeYieldLoopAction } from "./actions/loop.js";
import { rebalancePortfolioAction } from "./actions/rebalance.js";
import { kaminoProvider } from "./providers/kamino.js";

export const kaminoPlugin: Plugin = {
    name: "kamino",
    description: "Kamino Finance Plugin for Leveraged Yield Looping and Portfolio Rebalancing with enhanced balance checking and TSLAx collateral support.",
    actions: [
        buyRwaAction,
        depositAction,
        borrowAction,
        checkAllBalancesAction,
        checkSingleBalanceAction,
        executeYieldLoopAction,
        rebalancePortfolioAction
    ],
    providers: [kaminoProvider],
};

export default kaminoPlugin;
