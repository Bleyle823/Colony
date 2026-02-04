import { Plugin } from "@elizaos/core";
import { getBalanceAction, sendTokenAction } from "./actions/transfer";
import { swapTokenAction } from "./actions/swap";

export const arcPlugin: Plugin = {
    name: "arc",
    description: "Arc Blockchain integration for Balance, Transfer, and Swap.",
    actions: [
        getBalanceAction,
        sendTokenAction,
        swapTokenAction
    ],
    providers: [],
    services: []
};

export default arcPlugin;
