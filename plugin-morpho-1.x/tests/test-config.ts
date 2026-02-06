import { IAgentRuntime } from '@elizaos/core';

export interface TestConfig {
    rpcUrl: string;
    network: 'base' | 'base-sepolia';
    privateKey: string;
    morphoApiUrl?: string;
}

export const testConfig: TestConfig = {
    rpcUrl: process.env.TEST_BASE_RPC_URL || 'https://mainnet.base.org',
    network: (process.env.TEST_MORPHO_NETWORK as 'base' | 'base-sepolia') || 'base',
    privateKey: process.env.TEST_WALLET_PRIVATE_KEY || '0x' + '0'.repeat(64), // Default test key
    morphoApiUrl: process.env.TEST_MORPHO_API_URL
};

// Mock runtime for testing
export function createMockRuntime(overrides: Partial<TestConfig> = {}): IAgentRuntime {
    const config = { ...testConfig, ...overrides };
    
    return {
        // Core runtime methods
        getSetting: (key: string) => {
            const settings: Record<string, any> = {
                'BASE_RPC_URL': config.rpcUrl,
                'MORPHO_NETWORK': config.network,
                'WALLET_PRIVATE_KEY': config.privateKey,
                'MORPHO_API_URL': config.morphoApiUrl,
                'MAX_GAS_FOR_MATCHING': '500000',
                'MATCHING_EFFICIENCY_THRESHOLD': 0.7,
                'RATE_IMPROVEMENT_THRESHOLD': 0.1,
                'MAX_GAS_PRICE': '50000000000',
                'RETRY_ATTEMPTS': 3,
                'MONITORING_INTERVAL': 60000
            };
            return settings[key];
        },
        
        // Mock other required runtime methods
        character: {
            name: 'TestAgent',
            bio: 'Test agent for Morpho plugin',
            lore: [],
            messageExamples: [],
            postExamples: [],
            topics: [],
            style: {
                all: ['helpful', 'informative']
            },
            adjectives: ['efficient', 'reliable']
        },
        
        databaseAdapter: {} as any,
        token: 'test-token',
        modelProvider: 'test',
        
        // Mock methods that might be called
        composeState: async () => ({}),
        updateRecentMessageState: async () => ({}),
        
        // Add any other methods that tests might need
        registerAction: () => {},
        processActions: async () => [],
        
        // Service-related mocks
        getService: () => null,
        registerService: () => {},
        
        // Memory-related mocks
        messageManager: {} as any,
        descriptionManager: {} as any,
        factManager: {} as any,
        loreManager: {} as any,
        
        // Cache-related mocks
        cacheManager: {} as any,
        
        // Provider-related mocks
        providers: [],
        
        // Evaluator-related mocks  
        evaluators: [],
        
        // Action-related mocks
        actions: []
    } as unknown as IAgentRuntime;
}

// Test market IDs for Base network
export const TEST_MARKET_IDS = {
    USDC: "0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc" as const,
    WETH: "0x1c21c59df9db44bf6f645d854ee710a8ca17b479451447e9f56758aee10a2fad" as const,
    DAI: "0x8793a23facb1fe3fb1e4e61206bb7be689ad4e41db6bb2b8a44b1a0c9e56b7c4" as const
};

// Test vault addresses for Base network
export const TEST_VAULT_ADDRESSES = {
    USDC: "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458" as const,
    WETH: "0x39Dd7790e75C6F663731f7E1FdC0f35007D3879b" as const,
    DAI: "0x500331C9fF24D9d11aee6B07734Aa72343EA74a5" as const
};

// Mock addresses for testing
export const TEST_ADDRESSES = {
    user: "0x742d35Cc6574C0532C3C07A4c5Eb821Fe8667b67" as const,
    recipient: "0x8ba1f109551bD432803012645aac136c52211111" as const
};

// Utility functions for tests
export function skipIfNoRpc() {
    if (!process.env.TEST_BASE_RPC_URL) {
        console.warn('Skipping test: No TEST_BASE_RPC_URL provided');
        return true;
    }
    return false;
}

export function skipIfNoPrivateKey() {
    if (!process.env.TEST_WALLET_PRIVATE_KEY) {
        console.warn('Skipping test: No TEST_WALLET_PRIVATE_KEY provided');
        return true;
    }
    return false;
}

export function shouldRunIntegrationTests() {
    return process.env.RUN_INTEGRATION_TESTS === 'true' && 
           process.env.TEST_BASE_RPC_URL && 
           process.env.TEST_WALLET_PRIVATE_KEY;
}