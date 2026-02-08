/**
 * Workflow Management System
 * 
 * Exports all workflow classes for coordinating multi-agent operations
 */

export { DepositWorkflow } from './depositWorkflow';
export type { DepositRequest, DepositStep } from './depositWorkflow';

export { WithdrawalWorkflow } from './withdrawalWorkflow';
export type { WithdrawalRequest, WithdrawalStep } from './withdrawalWorkflow';

export { RiskManagementWorkflow } from './riskManagement';
export type { RiskAlert, RiskThresholds } from './riskManagement';

/**
 * Workflow Factory
 * 
 * Creates and manages workflow instances
 */
import { IAgentRuntime } from '@elizaos/core';
import { DepositWorkflow, DepositRequest } from './depositWorkflow';
import { WithdrawalWorkflow, WithdrawalRequest } from './withdrawalWorkflow';
import { RiskManagementWorkflow } from './riskManagement';

export class WorkflowManager {
  private runtime: IAgentRuntime;
  private activeWorkflows: Map<string, any>;
  private riskManager: RiskManagementWorkflow;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.activeWorkflows = new Map();
    this.riskManager = new RiskManagementWorkflow(runtime);
  }

  /**
   * Initialize workflow manager and start risk monitoring
   */
  async initialize(): Promise<void> {
    await this.riskManager.startMonitoring();
  }

  /**
   * Create and execute a deposit workflow
   */
  async executeDeposit(request: DepositRequest): Promise<string> {
    const workflow = new DepositWorkflow(this.runtime, request);
    const workflowId = `deposit_${Date.now()}`;
    
    this.activeWorkflows.set(workflowId, workflow);
    
    // Execute workflow asynchronously
    workflow.execute().finally(() => {
      this.activeWorkflows.delete(workflowId);
    });

    return workflowId;
  }

  /**
   * Create and execute a withdrawal workflow
   */
  async executeWithdrawal(request: WithdrawalRequest): Promise<string> {
    const workflow = new WithdrawalWorkflow(this.runtime, request);
    const workflowId = `withdrawal_${Date.now()}`;
    
    this.activeWorkflows.set(workflowId, workflow);
    
    // Execute workflow asynchronously
    workflow.execute().finally(() => {
      this.activeWorkflows.delete(workflowId);
    });

    return workflowId;
  }

  /**
   * Get status of a specific workflow
   */
  getWorkflowStatus(workflowId: string): any {
    const workflow = this.activeWorkflows.get(workflowId);
    return workflow ? workflow.getStatus() : null;
  }

  /**
   * Get risk management status
   */
  getRiskStatus(): any {
    return this.riskManager.getRiskStatus();
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows(): string[] {
    return Array.from(this.activeWorkflows.keys());
  }

  /**
   * Stop all workflows and risk monitoring
   */
  shutdown(): void {
    this.riskManager.stopMonitoring();
    this.activeWorkflows.clear();
  }
}