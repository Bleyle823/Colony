import { Plugin } from "@elizaos/core";
import { supplyCollateralAction } from "./actions/supply";
import { borrowAction } from "./actions/borrow";
import { repayAction } from "./actions/repay";
import { withdrawCollateralAction } from "./actions/withdraw";
import { morphoProvider } from "./providers/morphoProvider";

export const morphoPlugin: Plugin = {
    name: "morpho-ethereum",
    description: "Morpho Blue integration (Ethereum mainnet) for supplying collateral and borrowing assets",
    actions: [
        supplyCollateralAction,
        borrowAction,
        repayAction,
        withdrawCollateralAction
    ],
    providers: [morphoProvider],
};
