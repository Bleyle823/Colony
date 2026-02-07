import {
  IAgentRuntime,
  Service,
  ServiceType,
  Memory,
  elizaLogger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

export interface AgentTask {
  id: string;
  fromAgent: string;
  toAgent: string;
  taskType: string;
  payload: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioState {
  id: string;
  userId: string;
  totalUsdcValue: number;
  rwaPositions: Record<string, any>;
  leverageRatio: number;
  healthFactor: number;
  updatedAt: Date;
}

/**
 * SwarmCoordinator Service
 * 
 * Manages inter-agent communication, task delegation, and shared state
 * for the multi-agent USDC portfolio management swarm.
 */
export class SwarmCoordinator extends Service {
  static serviceType: ServiceType = 'swarm_coordinator';

  // Room IDs for agent coordination
  private readonly COORDINATION_ROOM = 'swarm-coordination';
  private readonly PORTFOLIO_ROOM = 'portfolio-state';
  private readonly ALERTS_ROOM = 'risk-alerts';

  constructor() {
    super();
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    elizaLogger.info('Initializing SwarmCoordinator service');
    
    // Ensure coordination rooms exist
    await this.ensureRoomsExist(runtime);
    
    elizaLogger.info('SwarmCoordinator service initialized');
  }

  /**
   * Send a task to another agent in the swarm
   */
  async delegateTask(
    runtime: IAgentRuntime,
    fromAgent: string,
    toAgent: string,
    taskType: string,
    payload: any
  ): Promise<string> {
    const taskId = uuidv4();
    
    const task: AgentTask = {
      id: taskId,
      fromAgent,
      toAgent,
      taskType,
      payload,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store task in database
    await runtime.db.set(`task:${taskId}`, JSON.stringify(task));

    // Send message to coordination room
    const message: Memory = {
      id: uuidv4(),
      userId: fromAgent,
      agentId: runtime.agentId,
      roomId: this.COORDINATION_ROOM,
      content: {
        text: `Task delegation: ${taskType}`,
        action: 'DELEGATE_TASK',
        source: 'swarm_coordinator',
        metadata: {
          taskId,
          fromAgent,
          toAgent,
          taskType,
          payload,
        },
      },
      createdAt: Date.now(),
    };

    await runtime.createMemory(message);

    elizaLogger.info(`Task delegated: ${taskId} from ${fromAgent} to ${toAgent}`);
    return taskId;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    runtime: IAgentRuntime,
    taskId: string,
    status: AgentTask['status'],
    result?: any
  ): Promise<void> {
    const taskData = await runtime.db.get(`task:${taskId}`);
    if (!taskData) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const task: AgentTask = JSON.parse(taskData);
    task.status = status;
    task.updatedAt = new Date();

    if (result) {
      (task as any).result = result;
    }

    await runtime.db.set(`task:${taskId}`, JSON.stringify(task));

    // Notify completion in coordination room
    if (status === 'completed' || status === 'failed') {
      const message: Memory = {
        id: uuidv4(),
        userId: task.toAgent,
        agentId: runtime.agentId,
        roomId: this.COORDINATION_ROOM,
        content: {
          text: `Task ${status}: ${task.taskType}`,
          action: 'TASK_UPDATE',
          source: 'swarm_coordinator',
          metadata: {
            taskId,
            status,
            result,
          },
        },
        createdAt: Date.now(),
      };

      await runtime.createMemory(message);
    }

    elizaLogger.info(`Task status updated: ${taskId} -> ${status}`);
  }

  /**
   * Get pending tasks for an agent
   */
  async getPendingTasks(
    runtime: IAgentRuntime,
    agentName: string
  ): Promise<AgentTask[]> {
    const tasks: AgentTask[] = [];
    const keys = await runtime.db.getKeys('task:*');

    for (const key of keys) {
      const taskData = await runtime.db.get(key);
      if (taskData) {
        const task: AgentTask = JSON.parse(taskData);
        if (task.toAgent === agentName && task.status === 'pending') {
          tasks.push(task);
        }
      }
    }

    return tasks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Update portfolio state
   */
  async updatePortfolioState(
    runtime: IAgentRuntime,
    userId: string,
    state: Partial<PortfolioState>
  ): Promise<void> {
    const stateId = `portfolio:${userId}`;
    const existingData = await runtime.db.get(stateId);
    
    let portfolioState: PortfolioState;
    
    if (existingData) {
      portfolioState = { ...JSON.parse(existingData), ...state };
    } else {
      portfolioState = {
        id: uuidv4(),
        userId,
        totalUsdcValue: 0,
        rwaPositions: {},
        leverageRatio: 1.0,
        healthFactor: 999,
        ...state,
      } as PortfolioState;
    }

    portfolioState.updatedAt = new Date();

    await runtime.db.set(stateId, JSON.stringify(portfolioState));

    // Broadcast update to portfolio room
    const message: Memory = {
      id: uuidv4(),
      userId: 'system',
      agentId: runtime.agentId,
      roomId: this.PORTFOLIO_ROOM,
      content: {
        text: `Portfolio state updated for ${userId}`,
        action: 'PORTFOLIO_UPDATE',
        source: 'swarm_coordinator',
        metadata: {
          userId,
          portfolioState,
        },
      },
      createdAt: Date.now(),
    };

    await runtime.createMemory(message);

    elizaLogger.info(`Portfolio state updated for user: ${userId}`);
  }

  /**
   * Get portfolio state
   */
  async getPortfolioState(
    runtime: IAgentRuntime,
    userId: string
  ): Promise<PortfolioState | null> {
    const stateId = `portfolio:${userId}`;
    const data = await runtime.db.get(stateId);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Send risk alert to all relevant agents
   */
  async sendRiskAlert(
    runtime: IAgentRuntime,
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    data?: any
  ): Promise<void> {
    const alertId = uuidv4();

    const alertMessage: Memory = {
      id: alertId,
      userId: 'guardian',
      agentId: runtime.agentId,
      roomId: this.ALERTS_ROOM,
      content: {
        text: `🚨 ${severity.toUpperCase()} ALERT: ${message}`,
        action: 'RISK_ALERT',
        source: 'swarm_coordinator',
        metadata: {
          alertId,
          alertType,
          severity,
          message,
          data,
          timestamp: new Date().toISOString(),
        },
      },
      createdAt: Date.now(),
    };

    await runtime.createMemory(alertMessage);

    elizaLogger.warn(`Risk alert sent: ${alertType} - ${severity} - ${message}`);
  }

  /**
   * Get recent messages from a coordination room
   */
  async getCoordinationMessages(
    runtime: IAgentRuntime,
    roomType: 'coordination' | 'portfolio' | 'alerts' = 'coordination',
    limit: number = 10
  ): Promise<Memory[]> {
    const roomId = roomType === 'coordination' ? this.COORDINATION_ROOM :
                   roomType === 'portfolio' ? this.PORTFOLIO_ROOM :
                   this.ALERTS_ROOM;

    const memories = await runtime.getMemories({
      roomId,
      count: limit,
      unique: true,
    });

    return memories.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Ensure coordination rooms exist
   */
  private async ensureRoomsExist(runtime: IAgentRuntime): Promise<void> {
    const rooms = [this.COORDINATION_ROOM, this.PORTFOLIO_ROOM, this.ALERTS_ROOM];
    
    for (const roomId of rooms) {
      // Create a system message to ensure room exists
      const message: Memory = {
        id: uuidv4(),
        userId: 'system',
        agentId: runtime.agentId,
        roomId,
        content: {
          text: `Room initialized: ${roomId}`,
          action: 'ROOM_INIT',
          source: 'swarm_coordinator',
        },
        createdAt: Date.now(),
      };

      await runtime.createMemory(message);
    }
  }
}

export const swarmCoordinator = new SwarmCoordinator();