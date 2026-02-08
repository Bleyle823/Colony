import { Plugin } from "@elizaos/core";
import { 
    delegateTaskAction,
    reportStatusAction,
    coordinateWorkflowAction
} from "./actions/coordination";
import { 
    swarmStatusProvider,
    portfolioStateProvider
} from "./providers/swarmProvider";

export const swarmPlugin: Plugin = {
    name: "swarm",
    description: "Multi-agent swarm coordination for task delegation, status sharing, and workflow management",
    actions: [
        delegateTaskAction,
        reportStatusAction,
        coordinateWorkflowAction,
    ],
    providers: [
        swarmStatusProvider,
        portfolioStateProvider,
    ],
    services: []
};

export default swarmPlugin;