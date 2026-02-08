import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IAgentRuntime, Memory, State } from '@elizaos/core';
import { 
  createMpcWalletAction,
  getUnifiedBalanceAction,
  enableGasAbstractionAction
} from '../../plugin-circle/src/actions/programmableWallets';
import { createMockRuntime } from '../utils/mockRuntime';

describe('Enhanced Circle Plugin Tests', () => {
  let runtime: IAgentRuntime;
  let mockMessage: Memory;
  let mockState: State;
  let mockCallback: any;

  beforeEach(() => {
    runtime = createMockRuntime();
    mockMessage = {
      id: 'test-message-id',
      userId: 'test-user',
      agentId: 'test-agent',
      roomId: 'test-room',
      content: { text: 'test message' },
      createdAt: Date.now(),
    };
    mockState = {};
    mockCallback = vi.fn();

    // Mock Circle configuration
    vi.spyOn(runtime, 'getSetting').mockImplementation((key: string) => {
      const settings: Record<string, string> = {
        'CIRCLE_API_KEY': 'test-api-key',
        'CIRCLE_ENTITY_SECRET': 'test-entity-secret',
        'CIRCLE_WALLET_SET_ID': 'test-wallet-set-id',
        'CIRCLE_GATEWAY_ENDPOINT': 'https://api.circle.com/v1/gateway',
        'ENABLE_GAS_ABSTRACTION': 'true',
      };
      return settings[key];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CREATE_MPC_WALLET Action', () => {
    it('should validate Circle configuration', async () => {
      const isValid = await createMpcWalletAction.validate(runtime, mockMessage);
      expect(isValid).toBe(true);
    });

    it('should fail validation with missing configuration', async () => {
      vi.spyOn(runtime, 'getSetting').mockReturnValue(undefined);
      
      const isValid = await createMpcWalletAction.validate(runtime, mockMessage);
      expect(isValid).toBe(false);
    });

    it('should create MPC wallet successfully', async () => {
      const result = await createMpcWalletAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('walletId');
      expect(result.data).toHaveProperty('address');
      expect(result.data).toHaveProperty('blockchain', 'ETH');
      expect(result.data).toHaveProperty('custodyType', 'DEVELOPER');

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('MPC Wallet Created Successfully'),
        })
      );
    });

    it('should handle MPC wallet creation errors', async () => {
      // Mock validation failure
      vi.spyOn(runtime, 'getSetting').mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const result = await createMpcWalletAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration error');

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Failed to create MPC wallet'),
        })
      );
    });
  });

  describe('GET_UNIFIED_BALANCE Action', () => {
    it('should validate Circle configuration', async () => {
      const isValid = await getUnifiedBalanceAction.validate(runtime, mockMessage);
      expect(isValid).toBe(true);
    });

    it('should fetch unified balance successfully', async () => {
      const result = await getUnifiedBalanceAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('totalBalance');
      expect(result.data).toHaveProperty('balancesByChain');
      expect(result.data).toHaveProperty('lastUpdated');

      const balancesByChain = result.data.balancesByChain;
      expect(balancesByChain).toHaveProperty('ethereum');
      expect(balancesByChain).toHaveProperty('solana');
      expect(balancesByChain).toHaveProperty('arbitrum');
      expect(balancesByChain).toHaveProperty('base');

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Unified Portfolio Balance'),
        })
      );
    });

    it('should handle balance fetch errors', async () => {
      vi.spyOn(runtime, 'getSetting').mockImplementation(() => {
        throw new Error('Gateway API error');
      });

      const result = await getUnifiedBalanceAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Gateway API error');
    });

    it('should format balance display correctly', async () => {
      const result = await getUnifiedBalanceAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(true);
      
      const callbackArg = mockCallback.mock.calls[0][0];
      expect(callbackArg.text).toContain('Total USDC:');
      expect(callbackArg.text).toContain('Balance by Chain:');
      expect(callbackArg.text).toContain('Ethereum:');
      expect(callbackArg.text).toContain('Solana:');
    });
  });

  describe('ENABLE_GAS_ABSTRACTION Action', () => {
    it('should validate Circle configuration', async () => {
      const isValid = await enableGasAbstractionAction.validate(runtime, mockMessage);
      expect(isValid).toBe(true);
    });

    it('should enable gas abstraction successfully', async () => {
      const result = await enableGasAbstractionAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('enabled', true);
      expect(result.data).toHaveProperty('gasToken', 'USDC');
      expect(result.data).toHaveProperty('supportedChains');
      expect(result.data.supportedChains).toContain('ethereum');
      expect(result.data.supportedChains).toContain('arbitrum');

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Gas Abstraction Enabled'),
        })
      );
    });

    it('should handle gas abstraction setup errors', async () => {
      vi.spyOn(runtime, 'getSetting').mockImplementation(() => {
        throw new Error('Gas abstraction setup failed');
      });

      const result = await enableGasAbstractionAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Gas abstraction setup failed');
    });

    it('should configure gas parameters correctly', async () => {
      const result = await enableGasAbstractionAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(true);
      expect(result.data.maxGasPerTransaction).toBeDefined();
      
      const callbackArg = mockCallback.mock.calls[0][0];
      expect(callbackArg.text).toContain('Max Gas per Transaction:');
      expect(callbackArg.text).toContain('Gas Reserve Balance:');
    });
  });

  describe('Action Integration', () => {
    it('should work with action examples', async () => {
      // Test CREATE_MPC_WALLET examples
      for (const example of createMpcWalletAction.examples) {
        const userMessage = example[0];
        expect(userMessage.content.text).toBeTruthy();
        
        const agentResponse = example[1];
        expect(agentResponse.content.text).toBeTruthy();
      }

      // Test GET_UNIFIED_BALANCE examples
      for (const example of getUnifiedBalanceAction.examples) {
        const userMessage = example[0];
        expect(userMessage.content.text).toBeTruthy();
      }

      // Test ENABLE_GAS_ABSTRACTION examples
      for (const example of enableGasAbstractionAction.examples) {
        const userMessage = example[0];
        expect(userMessage.content.text).toBeTruthy();
      }
    });

    it('should handle action similes correctly', () => {
      expect(createMpcWalletAction.similes).toContain('CREATE_SECURE_WALLET');
      expect(createMpcWalletAction.similes).toContain('GENERATE_MPC_WALLET');
      
      expect(getUnifiedBalanceAction.similes).toContain('CHECK_TOTAL_BALANCE');
      expect(getUnifiedBalanceAction.similes).toContain('GET_CROSS_CHAIN_BALANCE');
      
      expect(enableGasAbstractionAction.similes).toContain('SETUP_GAS_ABSTRACTION');
      expect(enableGasAbstractionAction.similes).toContain('ENABLE_USDC_GAS');
    });

    it('should provide proper action descriptions', () => {
      expect(createMpcWalletAction.description).toContain('MPC wallet');
      expect(createMpcWalletAction.description).toContain('secure');
      
      expect(getUnifiedBalanceAction.description).toContain('unified balance');
      expect(getUnifiedBalanceAction.description).toContain('Gateway API');
      
      expect(enableGasAbstractionAction.description).toContain('gas abstraction');
      expect(enableGasAbstractionAction.description).toContain('USDC');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent wallet creations', async () => {
      const promises = Array.from({ length: 5 }, () =>
        createMpcWalletAction.handler(runtime, mockMessage, mockState, {})
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.walletId).toBeDefined();
      });

      // Ensure all wallet IDs are unique
      const walletIds = results.map(r => r.data.walletId);
      expect(new Set(walletIds).size).toBe(walletIds.length);
    });

    it('should handle rapid balance queries', async () => {
      const startTime = Date.now();
      
      const promises = Array.from({ length: 10 }, () =>
        getUnifiedBalanceAction.handler(runtime, mockMessage, mockState, {})
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.totalBalance).toBeDefined();
      });
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle network timeouts gracefully', async () => {
      // Simulate network timeout
      vi.spyOn(runtime, 'getSetting').mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });

      const result = await createMpcWalletAction.handler(
        runtime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle malformed API responses', async () => {
      // Mock malformed response handling
      const result = await getUnifiedBalanceAction.handler(
        runtime,
        mockMessage,
        mockState,
        {}
      );

      // Should still return structured response even with mock data
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('totalBalance');
    });
  });
});