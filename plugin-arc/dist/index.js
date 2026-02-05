import { transferAction } from "./actions/transfer.js";
import { getAddressAction } from "./actions/getAddress.js";
export const arcPlugin = {
    name: "arc",
    description: "Arc Network Plugin for ElizaOS",
    actions: [transferAction, getAddressAction],
    evaluators: [],
    providers: [],
};
export default arcPlugin;
