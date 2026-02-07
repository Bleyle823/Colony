import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IAgentRuntime, Memory } from '@elizaos/core';
import { swarmCoordinator } from '../../services/swarmCoordinator';
import { createMockRuntime } from '../utils/mockRuntime';

describe('Agent Communication Tests', () => {
  let runtime: IAgentRuntime;
  let mockUserId: string;

  beforeEach(async () => {
    runtime = createMockRuntime();
    mockUserId = 'test-user-123';
    await swarmCoordinator.initialize(runtime);
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Task Delegation', () => {
    it('should delegate task between agents', async () => {
      const taskId = await swarmCoordinator.delegateTask(
        runtime,
        'manager',
        'treasurer',
        'SWAP_TOKENS',
        {
          description: 'Swap 100 USDC for mF-ONE',
          amount: 100,
          priority: 'high',
        }
      );

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');

      // Verify task was stored
      const taskData = await runtime.db.get(`task:${taskId}`);
      expect(taskData).toBeDefined();

      const task = JSON.parse(taskData);
      expect(task.fromAgent).toBe('manager');
      expect(task.toAgent).toBe('treasurer');
      expect(task.taskType).toBe('SWAP_TOKENS');
      expect(task.status).toBe('pending');
    });

    it('should retrieve pending tasks for agent', async () => {
      // Create multiple tasks for treasurer
      await swarmCoordinator.delegateTask(runtime, 'manager', 'treasurer', 'TASK_1', {});
      await swarmCoordinator.delegateTask(runtime, 'strategist', 'treasurer', 'TASK_2', {});
      await swarmCoordinator.delegateTask(runtime, 'guardian', 'manager', 'TASK_3', {}); // Different agent

      const treasurerTasks = await swarmCoordinator.getPendingTasks(runtime, 'treasurer');
      const managerTasks = await swarmCoordinator.getPendingTasks(runtime, 'manager');

      expect(treasurerTasks).toHaveLength(2);
      expect(managerTasks).toHaveLength(1);
      
      expect(treasurerTasks[0].taskType).toBe('TASK_1');
      expect(treasurerTasks[1].taskType).toBe('TASK_2');
    });

    it('should update task status', async () => {
      const taskId = await swarmCoordinator.delegateTask(
        runtime,
        'manager',
        'treasurer',
        'TEST_TASK',
        { description: 'Test task' }
      );

      // Update to in_progress
      await swarmCoordinator.updateTaskStatus(runtime, taskId, 'in_progress');
      
      let taskData = JSON.parse(await runtime.db.get(`task:${taskId}`));
      expect(taskData.status).toBe('in_progress');

      // Update to completed with result
      const result = { success: true, txHash: '0x123' };
      await swarmCoordinator.updateTaskStatus(runtime, taskId, 'completed', result);
      
      taskData = JSON.parse(await runtime.db.get(`task:${taskId}`));
      expect(taskData.status).toBe('completed');
      expect(taskData.result).toEqual(result);
    });
  });

  describe('Portfolio State Management', () => {
    it('should update portfolio state', async () => {
      const portfolioUpdate = {
        totalUsdcValue: 2500.0,
        leverageRatio: 2.8,
        healthFactor: 1.25,
        rwaPositions: {
          'mF-ONE': { amount: 1200, value: 1200 },
          'GLDx': { amount: 800, value: 850 },
        },
      };

      await swarmCoordinator.updatePortfolioState(runtime, mockUserId, portfolioUpdate);

      const retrievedState = await swarmCoordinator.getPortfolioState(runtime, mockUserId);
      
      expect(retrievedState).toBeDefined();
      expect(retrievedState!.totalUsdcValue).toBe(2500.0);
      expect(retrievedState!.leverageRatio).toBe(2.8);
      expect(retrievedState!.healthFactor).toBe(1.25);
      expect(retrievedState!.rwaPositions).toEqual(portfolioUpdate.rwaPositions);
    });

    it('should merge partial portfolio updates', async () => {
      // Initial state
      await swarmCoordinator.updatePortfolioState(runtime, mockUserId, {
        totalUsdcValue: 1000.0,
        leverageRatio: 2.0,
        healthFactor: 1.5,
      });

      // Partial update
      await swarmCoordinator.updatePortfolioState(runtime, mockUserId, {
        leverageRatio: 2.5,
        healthFactor: 1.3,
      });

      const state = await swarmCoordinator.getPortfolioState(runtime, mockUserId);
      
      expect(state!.totalUsdcValue).toBe(1000.0); // Unchanged
      expect(state!.leverageRatio).toBe(2.5); // Updated
      expect(state!.healthFactor).toBe(1.3); // Updated
    });
  });

  describe('Risk Alert System', () => {
    it('should send risk alerts', async () => {
      await swarmCoordinator.sendRiskAlert(
        runtime,
        'HEALTH_FACTOR',
        'critical',
        'Health factor below critical threshold',
        { healthFactor: 1.05, userId: mockUserId }
      );

      const alertMessages = await swarmCoordinator.getCoordinationMessages(runtime, 'alerts', 5);
      
      expect(alertMessages).toHaveLength(1);
      expect(alertMessages[0].content.text).toContain('CRITICAL ALERT');
      expect(alertMessages[0].content.metadata.alertType).toBe('HEALTH_FACTOR');
      expect(alertMessages[0].content.metadata.severity).toBe('critical');
    });

    it('should retrieve coordination messages', async () => {
      // Send multiple coordination messages
      await swarmCoordinator.delegateTask(runtime, 'manager', 'treasurer', 'TASK_1', {});
      await swarmCoordinator.delegateTask(runtime, 'treasurer', 'strategist', 'TASK_2', {});
      
      const messages = await swarmCoordinator.getCoordinationMessages(runtime, 'coordination', 10);
      
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].content.action).toBe('DELEGATE_TASK');
    });
  });

  describe('Message Routing', () => {
    it('should route messages to correct rooms', async () => {
      const taskId = await swarmCoordinator.delegateTask(
        runtime,
        'manager',
        'treasurer',
        'TEST_ROUTING',
        { test: true }
      );

      // Check coordination room
      const coordMessages = await swarmCoordinator.getCoordinationMessages(runtime, 'coordination', 5);
      const taskMessage = coordMessages.find(msg => 
        msg.content.metadata?.taskId === taskId
      );
      
      expect(taskMessage).toBeDefined();
      expect(taskMessage!.roomId).toBe('swarm-coordination');
    });

    it('should handle concurrent task delegation', async () => {
      const tasks = await Promise.all([
        swarmCoordinator.delegateTask(runtime, 'manager', 'treasurer', 'CONCURRENT_1', {}),
        swarmCoordinator.delegateTask(runtime, 'manager', 'strategist', 'CONCURRENT_2', {}),
        swarmCoordinator.delegateTask(runtime, 'manager', 'guardian', 'CONCURRENT_3', {}),
      ]);

      expect(tasks).toHaveLength(3);
      expect(new Set(tasks).size).toBe(3); // All unique task IDs

      // Verify all tasks were stored
      for (const taskId of tasks) {
        const taskData = await runtime.db.get(`task:${taskId}`);
        expect(taskData).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid task updates', async () => {
      await expect(
        swarmCoordinator.updateTaskStatus(runtime, 'invalid-task-id', 'completed')
      ).rejects.toThrow('Task not found');
    });

    it('should handle missing portfolio state', async () => {
      const state = await swarmCoordinator.getPortfolioState(runtime, 'non-existent-user');
      expect(state).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalGet = runtime.db.get;
      runtime.db.get = async () => {
        throw new Error('Database connection failed');
      };

      const state = await swarmCoordinator.getPortfolioState(runtime, mockUserId);
      expect(state).toBeNull();

      // Restore original method
      runtime.db.get = originalGet;
    });
  });

  describe('Performance Tests', () => {
    it('should handle high volume task delegation', async () => {
      const startTime = Date.now();
      const taskCount = 50;
      
      const tasks = await Promise.all(
        Array.from({ length: taskCount }, (_, i) =>
          swarmCoordinator.delegateTask(
            runtime,
            'manager',
            'treasurer',
            `PERF_TEST_${i}`,
            { index: i }
          )
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(tasks).toHaveLength(taskCount);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all tasks were stored correctly
      const treasurerTasks = await swarmCoordinator.getPendingTasks(runtime, 'treasurer');
      expect(treasurerTasks.length).toBeGreaterThanOrEqual(taskCount);
    });
  });
});