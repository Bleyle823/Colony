import { transferAction } from "./actions/transfer.js";
import { getAddressAction } from "./actions/getAddress.js";
import { bridgeAction } from "./actions/bridge.js";
export const arcPlugin = {
    name: "arc",
    description: "Arc Network Plugin for ElizaOS",
    actions: [transferAction, getAddressAction, bridgeAction],
    evaluators: [],
    providers: [],
};
export default arcPlugin;
