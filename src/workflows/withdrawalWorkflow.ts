import { IAgentRuntime, elizaLogger } from '@elizaos/core';
import { swarmCoordinator } from '../services/swarmCoordinator';

export interface WithdrawalRequest {
  userId: string;
  amount: number;
  targetChain?: string;
  targetAddress?: string;
}

export interface WithdrawalStep {
  id: string;
  agent: string;
  action: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

/**
 * Withdrawal Workflow
 * 
 * Coordinates the complete withdrawal process across all agents:
 * 1. Manager receives withdrawal request
 * 2. Guardian assesses current risk levels
 * 3. Strategist repays Morpho loans
 * 4. Strategist releases RWA collateral to Treasurer
 * 5. Treasurer swaps RWAs back to USDC
 * 6. Treasurer bridges USDC to user via CCTP
 */
export class WithdrawalWorkflow {
  private workflowId: string;
  private request: WithdrawalRequest;
  private steps: WithdrawalStep[];
  private runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime, request: WithdrawalRequest) {
    this.runtime = runtime;
    this.request = request;
    this.workflowId = `withdrawal_${Date.now()}`;
    this.steps = this.initializeSteps();
  }

  /**
   * Initialize the workflow steps
   */
  private initializeSteps(): WithdrawalStep[] {
    return [
      {
        id: 'risk_assessment',
        agent: 'guardian',
        action: 'ASSESS_WITHDRAWAL_RISK',
        description: 'Assess current risk levels and withdrawal impact',
        status: 'pending',
      },
      {
        id: 'calculate_repayment',
        agent: 'strategist',
        action: 'CALCULATE_REPAYMENT',
        description: 'Calculate required loan repayment amount',
        status: 'pending',
      },
      {
        id: 'repay_loans',
        agent: 'strategist',
        action: 'REPAY_MORPHO',
        description: 'Repay USDC loans on Morpho',
        status: 'pending',
      },
      {
        id: 'withdraw_collateral',
        agent: 'strategist',
        action: 'WITHDRAW_COLLATERAL_MORPHO',
        description: 'Withdraw RWA collateral from Morpho',
        status: 'pending',
      },
      {
        id: 'transfer_rwa_to_treasurer',
        agent: 'strategist',
        action: 'TRANSFER_RWA',
        description: 'Transfer RWA tokens to Treasurer',
        status: 'pending',
      },
      {
        id: 'swap_rwa_to_usdc',
        agent: 'treasurer',
        action: 'EVM_SWAP_TOKENS',
        description: 'Swap RWA tokens back to USDC',
        status: 'pending',
      },
      {
        id: 'bridge_to_user',
        agent: 'treasurer',
        action: 'CCTP_BRIDGE',
        description: 'Bridge USDC to user via CCTP',
        status: 'pending',
      },
      {
        id: 'update_portfolio',
        agent: 'manager',
        action: 'UPDATE_PORTFOLIO_STATE',
        description: 'Update portfolio state and notify user',
        status: 'pending',
      },
    ];
  }

  /**
   * Execute the complete withdrawal workflow
   */
  async execute(): Promise<boolean> {
    elizaLogger.info(`Starting withdrawal workflow ${this.workflowId} for ${this.request.amount} USDC`);

    try {
      // Get current portfolio state
      const currentState = await swarmCoordinator.getPortfolioState(this.runtime, this.request.userId);
      if (!currentState) {
        throw new Error('Portfolio state not found');
      }

      // Validate withdrawal amount
      if (this.request.amount > currentState.totalUsdcValue) {
        throw new Error(`Insufficient funds. Available: ${currentState.totalUsdcValue}, Requested: ${this.request.amount}`);
      }

      // Execute steps sequentially
      for (const step of this.steps) {
        elizaLogger.info(`Executing step: ${step.id} - ${step.description}`);
        
        const success = await this.executeStep(step);
        if (!success) {
          elizaLogger.error(`Step failed: ${step.id}`);
          await this.handleFailure(step);
          return false;
        }

        // Add delay between steps for realistic processing
        await this.delay(2000);
      }

      elizaLogger.info(`Withdrawal workflow ${this.workflowId} completed successfully`);
      await this.notifyCompletion();
      return true;

    } catch (error) {
      elizaLogger.error(`Withdrawal workflow ${this.workflowId} failed:`, error);
      await this.handleWorkflowFailure(error);
      return false;
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WithdrawalStep): Promise<boolean> {
    try {
      step.status = 'in_progress';

      // Special handling for risk assessment step
      if (step.id === 'risk_assessment') {
        const riskResult = await this.performRiskAssessment();
        if (!riskResult.safe) {
          throw new Error(`Withdrawal blocked: ${riskResult.reason}`);
        }
        step.result = riskResult;
      } else {
        // Delegate task to appropriate agent
        const taskId = await swarmCoordinator.delegateTask(
          this.runtime,
          'manager', // Workflow coordinator
          step.agent,
          step.action,
          {
            workflowId: this.workflowId,
            stepId: step.id,
            description: step.description,
            amount: this.request.amount,
            userId: this.request.userId,
            targetAddress: this.request.targetAddress,
            priority: 'high',
          }
        );

        step.result = { taskId, timestamp: new Date().toISOString() };
        await swarmCoordinator.updateTaskStatus(this.runtime, taskId, 'completed', step.result);
      }

      // Simulate step execution
      await this.delay(3000);

      step.status = 'completed';
      return true;
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      elizaLogger.error(`Step ${step.id} failed:`, error);
      return false;
    }
  }

  /**
   * Perform risk assessment for withdrawal
   */
  private async performRiskAssessment(): Promise<{ safe: boolean; reason?: string; healthFactor?: number }> {
    const currentState = await swarmCoordinator.getPortfolioState(this.runtime, this.request.userId);
    if (!currentState) {
      return { safe: false, reason: 'Portfolio state unavailable' };
    }

    // Calculate post-withdrawal health factor
    const remainingValue = currentState.totalUsdcValue - this.request.amount;
    const postWithdrawalHealthFactor = currentState.healthFactor * (remainingValue / currentState.totalUsdcValue);

    // Check if withdrawal would put portfolio at risk
    if (postWithdrawalHealthFactor < 1.15) {
      return { 
        safe: false, 
        reason: `Withdrawal would reduce health factor to ${postWithdrawalHealthFactor.toFixed(2)} (minimum: 1.15)`,
        healthFactor: postWithdrawalHealthFactor
      };
    }

    // Check if withdrawal amount is reasonable (max 80% of portfolio)
    const withdrawalPercentage = (this.request.amount / currentState.totalUsdcValue) * 100;
    if (withdrawalPercentage > 80) {
      return { 
        safe: false, 
        reason: `Withdrawal amount too large: ${withdrawalPercentage.toFixed(1)}% of portfolio (maximum: 80%)` 
      };
    }

    return { 
      safe: true, 
      healthFactor: postWithdrawalHealthFactor 
    };
  }

  /**
   * Handle step failure
   */
  private async handleFailure(failedStep: WithdrawalStep): Promise<void> {
    elizaLogger.warn(`Handling failure for step: ${failedStep.id}`);

    // Send alert to Guardian
    await swarmCoordinator.sendRiskAlert(
      this.runtime,
      'WORKFLOW_FAILURE',
      'medium',
      `Withdrawal workflow step failed: ${failedStep.description}`,
      {
        workflowId: this.workflowId,
        stepId: failedStep.id,
        error: failedStep.error,
      }
    );

    // Attempt recovery for certain steps
    if (failedStep.id === 'swap_rwa_to_usdc' || failedStep.id === 'bridge_to_user') {
      elizaLogger.info(`Attempting recovery for step: ${failedStep.id}`);
      // Could implement retry logic here
    }
  }

  /**
   * Handle complete workflow failure
   */
  private async handleWorkflowFailure(error: any): Promise<void> {
    await swarmCoordinator.sendRiskAlert(
      this.runtime,
      'WORKFLOW_FAILURE',
      'high',
      `Withdrawal workflow failed: ${error.message}`,
      {
        workflowId: this.workflowId,
        userId: this.request.userId,
        amount: this.request.amount,
      }
    );
  }

  /**
   * Notify workflow completion
   */
  private async notifyCompletion(): Promise<void> {
    // Update final portfolio state
    const currentState = await swarmCoordinator.getPortfolioState(this.runtime, this.request.userId);
    if (currentState) {
      const finalValue = currentState.totalUsdcValue - this.request.amount;
      
      await swarmCoordinator.updatePortfolioState(this.runtime, this.request.userId, {
        totalUsdcValue: finalValue,
        leverageRatio: Math.max(1.0, currentState.leverageRatio * 0.9), // Reduce leverage
        healthFactor: Math.min(999, currentState.healthFactor * 1.1), // Improve health factor
      });

      elizaLogger.info(`Withdrawal workflow completed. Remaining portfolio value: $${finalValue}`);
    }
  }

  /**
   * Get workflow status
   */
  getStatus(): { workflowId: string; progress: number; currentStep: string; status: string } {
    const completedSteps = this.steps.filter(step => step.status === 'completed').length;
    const failedSteps = this.steps.filter(step => step.status === 'failed').length;
    const currentStep = this.steps.find(step => step.status === 'in_progress') || 
                       this.steps.find(step => step.status === 'pending');

    let status = 'in_progress';
    if (completedSteps === this.steps.length) {
      status = 'completed';
    } else if (failedSteps > 0) {
      status = 'failed';
    }

    return {
      workflowId: this.workflowId,
      progress: (completedSteps / this.steps.length) * 100,
      currentStep: currentStep?.description || 'Unknown',
      status,
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}