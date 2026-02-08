import { Plugin } from "@elizaos/core";
import { getQuoteAction } from "./actions/quote";
import { swapTokensAction } from "./actions/swap";
import { enhancedSwapTokensAction } from "./actions/enhancedSwap";

export const uniswapPlugin: Plugin = {
    name: "uniswap",
    description: "Enhanced Uniswap V4 Plugin for Swapping and Quoting with Robust RPC Handling",
    actions: [
        getQuoteAction,
        swapTokensAction,
        enhancedSwapTokensAction // Enhanced version with better error handling
    ],
    evaluators: [],
    providers: [],
};

export default uniswapPlugin;
