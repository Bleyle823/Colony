import { IAgentRuntime, Memory, State } from '@elizaos/core';
import { vi } from 'vitest';

/**
 * Create a mock runtime for testing
 */
export function createMockRuntime(): IAgentRuntime {
  const mockDb = new Map<string, string>();
  const mockMemories = new Map<string, Memory[]>();

  return {
    agentId: 'test-agent-id',
    character: {
      name: 'TestAgent',
      username: 'test',
      bio: ['Test agent for unit tests'],
      system: 'Test system prompt',
      messageExamples: [],
      style: { all: [], chat: [], post: [] },
      topics: [],
      plugins: [],
      settings: {},
    },
    
    // Database mock
    db: {
      get: vi.fn(async (key: string) => mockDb.get(key) || null),
      set: vi.fn(async (key: string, value: string) => {
        mockDb.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        mockDb.delete(key);
      }),
      getKeys: vi.fn(async (pattern: string) => {
        const keys = Array.from(mockDb.keys());
        if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          return keys.filter(key => key.startsWith(prefix));
        }
        return keys.filter(key => key === pattern);
      }),
    },

    // Memory management mock
    createMemory: vi.fn(async (memory: Memory) => {
      const roomMemories = mockMemories.get(memory.roomId) || [];
      roomMemories.push(memory);
      mockMemories.set(memory.roomId, roomMemories);
      return memory;
    }),

    getMemories: vi.fn(async (options: { roomId: string; count?: number; unique?: boolean }) => {
      const roomMemories = mockMemories.get(options.roomId) || [];
      const count = options.count || roomMemories.length;
      return roomMemories.slice(-count).reverse();
    }),

    // Settings mock
    getSetting: vi.fn((key: string) => {
      const defaultSettings: Record<string, string> = {
        'DATABASE_URL': 'sqlite://test.db',
        'LOG_LEVEL': 'info',
      };
      return defaultSettings[key];
    }),

    // Service management mock
    getService: vi.fn((serviceType: string) => {
      return {
        serviceType,
        initialize: vi.fn(),
      };
    }),

    registerService: vi.fn(),

    // Action management mock
    getAction: vi.fn((actionName: string) => {
      return {
        name: actionName,
        description: `Mock action: ${actionName}`,
        validate: vi.fn(() => true),
        handler: vi.fn(() => ({ success: true, text: 'Mock action executed' })),
      };
    }),

    // Provider management mock
    getProvider: vi.fn((providerName: string) => {
      return {
        name: providerName,
        get: vi.fn(() => ({ text: 'Mock provider data', values: {} })),
      };
    }),

    // Evaluation mock
    evaluate: vi.fn(async (message: Memory, state?: State) => {
      return {
        ...state,
        evaluatedAt: Date.now(),
      };
    }),

    // Completion mock
    completion: vi.fn(async (prompt: string, options?: any) => {
      return {
        text: `Mock completion for: ${prompt.substring(0, 50)}...`,
        model: 'mock-model',
      };
    }),

    // Embedding mock
    embed: vi.fn(async (text: string) => {
      // Return mock embedding vector
      return new Array(1536).fill(0).map(() => Math.random() - 0.5);
    }),

    // Utility methods
    processActions: vi.fn(async (message: Memory, responses: any[], state?: State) => {
      return responses;
    }),

    // Mock cleanup method
    cleanup: vi.fn(() => {
      mockDb.clear();
      mockMemories.clear();
    }),
  } as unknown as IAgentRuntime;
}

/**
 * Create a mock memory object
 */
export function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mock-memory-id',
    userId: 'mock-user-id',
    agentId: 'mock-agent-id',
    roomId: 'mock-room-id',
    content: {
      text: 'Mock message content',
      action: 'TEST_ACTION',
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock state object
 */
export function createMockState(overrides: Partial<State> = {}): State {
  return {
    userId: 'mock-user-id',
    agentId: 'mock-agent-id',
    roomId: 'mock-room-id',
    ...overrides,
  };
}

/**
 * Helper to wait for async operations in tests
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to create multiple mock memories
 */
export function createMockMemories(count: number, roomId: string = 'test-room'): Memory[] {
  return Array.from({ length: count }, (_, index) =>
    createMockMemory({
      id: `mock-memory-${index}`,
      roomId,
      content: { text: `Mock message ${index}` },
      createdAt: Date.now() - (count - index) * 1000, // Spread over time
    })
  );
}

/**
 * Mock callback function for action handlers
 */
export function createMockCallback() {
  return vi.fn((response: any) => {
    // Mock callback implementation
    console.log('Mock callback called with:', response);
  });
}