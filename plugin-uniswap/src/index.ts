import { Plugin } from "@elizaos/core";
import { getQuoteAction } from "./actions/quote";
import { swapTokensAction } from "./actions/swap";

export const uniswapPlugin: Plugin = {
    name: "uniswap",
    description: "Uniswap V4 Plugin for Swapping and Quoting",
    actions: [
        getQuoteAction,
        swapTokensAction
    ],
    evaluators: [],
    providers: [],
};

export default uniswapPlugin;
