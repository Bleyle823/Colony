import { describe, expect, it } from 'bun:test';
import { circlePlugin } from '../../plugin-circle/src/index';
import { crossChainTransferAction } from '../../plugin-circle/src/actions/transfer';
import { sendUsdcAction } from '../../plugin-circle/src/actions/payment';

describe('Circle Plugin', () => {
    it('should be defined', () => {
        expect(circlePlugin).toBeDefined();
    });

    it('should have the correct name', () => {
        expect(circlePlugin.name).toBe('circle');
    });

    it('should have the expected description', () => {
        expect(circlePlugin.description).toContain('Circle integration');
    });

    it('should export the expected actions', () => {
        expect(circlePlugin.actions).toBeDefined();
        expect(circlePlugin.actions?.length).toBeGreaterThan(0);
        
        // Check if specific actions are present
        const actionNames = circlePlugin.actions?.map(a => a.name);
        expect(actionNames).toContain('CROSS_CHAIN_TRANSFER');
        expect(actionNames).toContain('SEND_USDC');
    });

    it('should export actions that match the imported action objects', () => {
        expect(circlePlugin.actions).toContain(crossChainTransferAction);
        expect(circlePlugin.actions).toContain(sendUsdcAction);
    });
});
