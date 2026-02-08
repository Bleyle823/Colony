import { Action, IAgentRuntime, Memory, State, Provider, ProviderResult } from "@elizaos/core";
import { MorphoService } from "../morphoService";

export const morphoProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<ProviderResult> => {
        try {
            const service = new MorphoService(runtime);
            await service.initialize();

            const position = await service.getPosition();

            if (!position) {
                return "Morpho Blue: No active position or wallet not configured.";
            }

            return `Morpho Blue Position (mF-ONE/USDC):
- Collateral: ${position.collateral} ${position.collateralToken}
- Borrowed: ${position.borrowed} ${position.loanToken}
`;
        } catch (error) {
            // Log error but return null or string to satisfy ProviderResult
            return `Morpho Blue: Error fetching position (${error instanceof Error ? error.message : 'Unknown error'})`;
        }
    }
};
