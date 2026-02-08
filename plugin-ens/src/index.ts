import { Plugin } from "@elizaos/core";
import { resolveEnsAction, reverseResolveEnsAction } from "./actions/resolve";
import { getEnsAvatarAction, getEnsTextAction } from "./actions/info";
import { setEnsTextAction, setEnsAddressAction, setEnsAvatarAction } from "./actions/manage";

export const ensPlugin: Plugin = {
    name: "ens",
    description: "Ethereum Name Service (ENS) integration for resolving names, fetching avatars/text records, and managing records.",
    actions: [
        resolveEnsAction,
        reverseResolveEnsAction,
        getEnsAvatarAction,
        getEnsTextAction,
        setEnsTextAction,
        setEnsAddressAction,
        setEnsAvatarAction
    ],
    providers: [],
    services: []
};

export default ensPlugin;
