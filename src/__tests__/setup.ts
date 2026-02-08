import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { elizaLogger } from '@elizaos/core';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  // Initialize test database or other global resources
  console.log('🧪 Setting up test environment...');
});

afterAll(async () => {
  // Cleanup global resources
  console.log('🧹 Cleaning up test environment...');
});

beforeEach(() => {
  // Reset any global state before each test
});

afterEach(() => {
  // Cleanup after each test
});

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(() => {
  console.log = (...args: any[]) => {
    if (process.env.VERBOSE_TESTS === 'true') {
      originalConsole.log(...args);
    }
  };
  
  console.info = (...args: any[]) => {
    if (process.env.VERBOSE_TESTS === 'true') {
      originalConsole.info(...args);
    }
  };
  
  console.warn = (...args: any[]) => {
    if (process.env.VERBOSE_TESTS === 'true') {
      originalConsole.warn(...args);
    }
  };
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});