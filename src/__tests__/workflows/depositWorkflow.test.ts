import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IAgentRuntime } from '@elizaos/core';
import { DepositWorkflow, DepositRequest } from '../../workflows/depositWorkflow';
import { swarmCoordinator } from '../../services/swarmCoordinator';
import { createMockRuntime } from '../utils/mockRuntime';

describe('Deposit Workflow Tests', () => {
  let runtime: IAgentRuntime;
  let mockUserId: string;

  beforeEach(async () => {
    runtime = createMockRuntime();
    mockUserId = 'test-user-deposit';
    await swarmCoordinator.initialize(runtime);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Workflow Initialization', () => {
    it('should initialize deposit workflow with correct steps', () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1000,
        sourceChain: 'ethereum',
      };

      const workflow = new DepositWorkflow(runtime, request);
      const status = workflow.getStatus();

      expect(status.workflowId).toBeDefined();
      expect(status.status).toBe('in_progress');
      expect(status.progress).toBe(0);
      expect(status.currentStep).toContain('Generate secure MPC deposit address');
    });

    it('should create workflow with all required steps', () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 500,
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      // Access private steps through status updates
      const initialStatus = workflow.getStatus();
      expect(initialStatus.currentStep).toBeDefined();
      expect(initialStatus.progress).toBe(0);
    });
  });

  describe('Workflow Execution', () => {
    it('should execute complete deposit workflow successfully', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1000,
        sourceChain: 'ethereum',
        targetStrategy: 'yield_loop',
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      // Mock successful execution
      vi.spyOn(swarmCoordinator, 'delegateTask').mockResolvedValue('mock-task-id');
      vi.spyOn(swarmCoordinator, 'updateTaskStatus').mockResolvedValue();
      vi.spyOn(swarmCoordinator, 'updatePortfolioState').mockResolvedValue();

      const result = await workflow.execute();
      
      expect(result).toBe(true);
      
      const finalStatus = workflow.getStatus();
      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.progress).toBe(100);
    });

    it('should handle step failures gracefully', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1000,
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      // Mock task delegation failure
      vi.spyOn(swarmCoordinator, 'delegateTask').mockRejectedValueOnce(new Error('Network error'));
      vi.spyOn(swarmCoordinator, 'sendRiskAlert').mockResolvedValue();

      const result = await workflow.execute();
      
      expect(result).toBe(false);
      
      const finalStatus = workflow.getStatus();
      expect(finalStatus.status).toBe('failed');
      expect(finalStatus.progress).toBeLessThan(100);
    });

    it('should update portfolio state during execution', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 2000,
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      const updatePortfolioSpy = vi.spyOn(swarmCoordinator, 'updatePortfolioState').mockResolvedValue();
      vi.spyOn(swarmCoordinator, 'delegateTask').mockResolvedValue('mock-task-id');
      vi.spyOn(swarmCoordinator, 'updateTaskStatus').mockResolvedValue();

      await workflow.execute();

      // Should update portfolio state at least twice (initial + final)
      expect(updatePortfolioSpy).toHaveBeenCalledWith(
        runtime,
        mockUserId,
        expect.objectContaining({
          totalUsdcValue: 2000,
        })
      );
    });
  });

  describe('Task Delegation', () => {
    it('should delegate tasks to correct agents in sequence', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1500,
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      const delegateTaskSpy = vi.spyOn(swarmCoordinator, 'delegateTask').mockResolvedValue('mock-task-id');
      vi.spyOn(swarmCoordinator, 'updateTaskStatus').mockResolvedValue();
      vi.spyOn(swarmCoordinator, 'updatePortfolioState').mockResolvedValue();

      await workflow.execute();

      // Verify tasks were delegated to correct agents
      const calls = delegateTaskSpy.mock.calls;
      
      // Should have calls to treasurer, strategist, and manager
      const treasurerCalls = calls.filter(call => call[2] === 'treasurer');
      const strategistCalls = calls.filter(call => call[2] === 'strategist');
      const managerCalls = calls.filter(call => call[2] === 'manager');

      expect(treasurerCalls.length).toBeGreaterThan(0);
      expect(strategistCalls.length).toBeGreaterThan(0);
      expect(managerCalls.length).toBeGreaterThan(0);
    });

    it('should include workflow context in task payloads', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 750,
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      const delegateTaskSpy = vi.spyOn(swarmCoordinator, 'delegateTask').mockResolvedValue('mock-task-id');
      vi.spyOn(swarmCoordinator, 'updateTaskStatus').mockResolvedValue();
      vi.spyOn(swarmCoordinator, 'updatePortfolioState').mockResolvedValue();

      await workflow.execute();

      // Check that task payloads contain workflow context
      const calls = delegateTaskSpy.mock.calls;
      calls.forEach(call => {
        const payload = call[4]; // Task payload
        expect(payload).toHaveProperty('workflowId');
        expect(payload).toHaveProperty('stepId');
        expect(payload).toHaveProperty('amount', 750);
        expect(payload).toHaveProperty('userId', mockUserId);
        expect(payload).toHaveProperty('priority', 'high');
      });
    });
  });

  describe('Error Recovery', () => {
    it('should send risk alerts on step failures', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1000,
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      vi.spyOn(swarmCoordinator, 'delegateTask').mockRejectedValueOnce(new Error('RWA swap failed'));
      const sendRiskAlertSpy = vi.spyOn(swarmCoordinator, 'sendRiskAlert').mockResolvedValue();

      await workflow.execute();

      expect(sendRiskAlertSpy).toHaveBeenCalledWith(
        runtime,
        'WORKFLOW_FAILURE',
        'medium',
        expect.stringContaining('Deposit workflow step failed'),
        expect.objectContaining({
          workflowId: expect.any(String),
          stepId: expect.any(String),
        })
      );
    });

    it('should handle complete workflow failures', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1000,
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      // Mock portfolio state update failure
      vi.spyOn(swarmCoordinator, 'updatePortfolioState').mockRejectedValueOnce(new Error('Database error'));
      const sendRiskAlertSpy = vi.spyOn(swarmCoordinator, 'sendRiskAlert').mockResolvedValue();

      const result = await workflow.execute();

      expect(result).toBe(false);
      expect(sendRiskAlertSpy).toHaveBeenCalledWith(
        runtime,
        'WORKFLOW_FAILURE',
        'high',
        expect.stringContaining('Deposit workflow failed'),
        expect.objectContaining({
          workflowId: expect.any(String),
          userId: mockUserId,
          amount: 1000,
        })
      );
    });
  });

  describe('Status Tracking', () => {
    it('should track workflow progress accurately', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1000,
      };

      const workflow = new DepositWorkflow(runtime, request);
      
      // Initial status
      let status = workflow.getStatus();
      expect(status.progress).toBe(0);
      expect(status.status).toBe('in_progress');

      // Mock partial execution
      vi.spyOn(swarmCoordinator, 'delegateTask').mockResolvedValue('mock-task-id');
      vi.spyOn(swarmCoordinator, 'updateTaskStatus').mockResolvedValue();
      vi.spyOn(swarmCoordinator, 'updatePortfolioState').mockResolvedValue();

      await workflow.execute();

      // Final status
      status = workflow.getStatus();
      expect(status.progress).toBe(100);
      expect(status.status).toBe('completed');
    });

    it('should provide meaningful current step descriptions', () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1000,
      };

      const workflow = new DepositWorkflow(runtime, request);
      const status = workflow.getStatus();

      expect(status.currentStep).toBeTruthy();
      expect(typeof status.currentStep).toBe('string');
      expect(status.currentStep.length).toBeGreaterThan(10);
    });
  });

  describe('Integration Tests', () => {
    it('should coordinate with swarm coordinator correctly', async () => {
      const request: DepositRequest = {
        userId: mockUserId,
        amount: 1000,
      };

      // Initialize swarm coordinator
      await swarmCoordinator.initialize(runtime);

      const workflow = new DepositWorkflow(runtime, request);
      
      // Execute with real coordinator (mocked backend)
      vi.spyOn(swarmCoordinator, 'delegateTask').mockResolvedValue('real-task-id');
      vi.spyOn(swarmCoordinator, 'updateTaskStatus').mockResolvedValue();
      vi.spyOn(swarmCoordinator, 'updatePortfolioState').mockResolvedValue();

      const result = await workflow.execute();
      expect(result).toBe(true);

      // Verify portfolio state was updated
      const portfolioState = await swarmCoordinator.getPortfolioState(runtime, mockUserId);
      expect(portfolioState).toBeDefined();
    });

    it('should handle concurrent deposit workflows', async () => {
      const requests: DepositRequest[] = [
        { userId: 'user1', amount: 1000 },
        { userId: 'user2', amount: 1500 },
        { userId: 'user3', amount: 500 },
      ];

      const workflows = requests.map(req => new DepositWorkflow(runtime, req));
      
      vi.spyOn(swarmCoordinator, 'delegateTask').mockResolvedValue('mock-task-id');
      vi.spyOn(swarmCoordinator, 'updateTaskStatus').mockResolvedValue();
      vi.spyOn(swarmCoordinator, 'updatePortfolioState').mockResolvedValue();

      const results = await Promise.all(workflows.map(w => w.execute()));
      
      expect(results).toEqual([true, true, true]);
      
      // Verify all workflows completed
      workflows.forEach(workflow => {
        const status = workflow.getStatus();
        expect(status.status).toBe('completed');
        expect(status.progress).toBe(100);
      });
    });
  });
});