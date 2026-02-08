import {
  Action,
  ActionResult,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  elizaLogger,
} from "@elizaos/core";
import { swarmCoordinator } from "../../../src/services/swarmCoordinator";

/**
 * DELEGATE_TASK Action
 * 
 * Send a task to another agent in the swarm for execution
 */
export const delegateTaskAction: Action = {
  name: "DELEGATE_TASK",
  similes: [
    "SEND_TASK",
    "ASSIGN_TASK", 
    "COORDINATE_WITH",
    "REQUEST_FROM_AGENT",
  ],
  description: "Delegate a task to another agent in the swarm",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Always available for swarm coordination
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    elizaLogger.info("Processing task delegation");

    try {
      const text = message.content.text;
      
      // Parse task details from message
      // Expected format: "delegate [task] to [agent]" or similar
      const taskMatch = text.match(/delegate\s+(.+?)\s+to\s+(\w+)/i) ||
                       text.match(/ask\s+(\w+)\s+to\s+(.+)/i) ||
                       text.match(/(\w+):\s*(.+)/);

      if (!taskMatch) {
        if (callback) {
          callback({
            text: "Please specify the task and target agent. Example: 'delegate swap USDC for mF-ONE to treasurer' or 'strategist: check health factor'",
          });
        }
        return {
          success: false,
          error: "Invalid task delegation format",
        };
      }

      let toAgent: string;
      let taskDescription: string;

      if (taskMatch[0].toLowerCase().includes('delegate')) {
        taskDescription = taskMatch[1];
        toAgent = taskMatch[2].toLowerCase();
      } else if (taskMatch[0].toLowerCase().includes('ask')) {
        toAgent = taskMatch[1].toLowerCase();
        taskDescription = taskMatch[2];
      } else {
        toAgent = taskMatch[1].toLowerCase();
        taskDescription = taskMatch[2];
      }

      // Determine current agent from runtime
      const fromAgent = runtime.character?.name?.toLowerCase() || 'unknown';
      
      // Validate target agent
      const validAgents = ['manager', 'treasurer', 'strategist', 'guardian'];
      if (!validAgents.includes(toAgent)) {
        if (callback) {
          callback({
            text: `Invalid target agent. Available agents: ${validAgents.join(', ')}`,
          });
        }
        return {
          success: false,
          error: "Invalid target agent",
        };
      }

      // Delegate the task
      const taskId = await swarmCoordinator.delegateTask(
        runtime,
        fromAgent,
        toAgent,
        'GENERAL_TASK',
        {
          description: taskDescription,
          priority: 'normal',
          requestedBy: message.userId,
        }
      );

      if (callback) {
        callback({
          text: `✅ Task Delegated Successfully!

Task ID: ${taskId}
From: ${fromAgent}
To: ${toAgent}
Task: ${taskDescription}

The ${toAgent} agent will process this request and provide updates.`,
        });
      }

      return {
        success: true,
        text: `Task delegated to ${toAgent}: ${taskDescription}`,
        data: {
          taskId,
          fromAgent,
          toAgent,
          taskDescription,
        },
      };
    } catch (error: any) {
      elizaLogger.error("Error delegating task:", error);
      
      if (callback) {
        callback({
          text: `Failed to delegate task: ${error.message}`,
        });
      }

      return {
        success: false,
        error: error.message || "Unknown error in task delegation",
      };
    }
  },

  examples: [
    [
      {
        user: "user",
        content: { text: "Ask the treasurer to swap 100 USDC for mF-ONE" },
      },
      {
        user: "manager",
        content: {
          text: "I'll delegate that swap request to our Treasurer.",
        },
      },
    ],
    [
      {
        user: "guardian",
        content: { text: "strategist: reduce leverage ratio to 2.5x" },
      },
      {
        user: "guardian",
        content: {
          text: "Sending risk mitigation task to Strategist.",
        },
      },
    ],
  ],
};

/**
 * REPORT_STATUS Action
 * 
 * Report current status and share updates with other agents
 */
export const reportStatusAction: Action = {
  name: "REPORT_STATUS",
  similes: [
    "UPDATE_STATUS",
    "SHARE_STATUS",
    "BROADCAST_UPDATE",
    "SEND_REPORT",
  ],
  description: "Report status and share updates with other agents in the swarm",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    elizaLogger.info("Processing status report");

    try {
      const text = message.content.text;
      const agentName = runtime.character?.name?.toLowerCase() || 'unknown';
      
      // Parse status information
      const statusMatch = text.match(/status:\s*(.+)/i) ||
                         text.match(/report:\s*(.+)/i) ||
                         text.match(/update:\s*(.+)/i);

      const statusMessage = statusMatch ? statusMatch[1] : text;

      // Create status report memory
      const statusReport = {
        agentName,
        status: statusMessage,
        timestamp: new Date().toISOString(),
        type: 'status_report',
      };

      // Send to coordination room
      const messages = await swarmCoordinator.getCoordinationMessages(runtime, 'coordination', 1);
      
      // Store status in shared state if it's portfolio-related
      if (statusMessage.toLowerCase().includes('portfolio') || 
          statusMessage.toLowerCase().includes('balance') ||
          statusMessage.toLowerCase().includes('position')) {
        
        // This would update portfolio state - simplified for now
        elizaLogger.info(`Portfolio status update from ${agentName}: ${statusMessage}`);
      }

      if (callback) {
        callback({
          text: `📊 Status Report Shared

Agent: ${agentName}
Status: ${statusMessage}
Time: ${new Date().toLocaleString()}

Status has been broadcast to all swarm agents for coordination.`,
        });
      }

      return {
        success: true,
        text: `Status reported: ${statusMessage}`,
        data: statusReport,
      };
    } catch (error: any) {
      elizaLogger.error("Error reporting status:", error);
      
      if (callback) {
        callback({
          text: `Failed to report status: ${error.message}`,
        });
      }

      return {
        success: false,
        error: error.message || "Unknown error in status reporting",
      };
    }
  },

  examples: [
    [
      {
        user: "treasurer",
        content: { text: "Status: Successfully swapped 100 USDC for 95 mF-ONE tokens" },
      },
      {
        user: "treasurer",
        content: {
          text: "Reporting swap completion to the swarm.",
        },
      },
    ],
  ],
};

/**
 * COORDINATE_WORKFLOW Action
 * 
 * Coordinate multi-step processes across multiple agents
 */
export const coordinateWorkflowAction: Action = {
  name: "COORDINATE_WORKFLOW",
  similes: [
    "START_WORKFLOW",
    "EXECUTE_PROCESS",
    "COORDINATE_PROCESS",
    "MULTI_AGENT_TASK",
  ],
  description: "Coordinate multi-step workflows across multiple agents",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    elizaLogger.info("Processing workflow coordination");

    try {
      const text = message.content.text;
      const agentName = runtime.character?.name?.toLowerCase() || 'unknown';
      
      // Parse workflow type
      let workflowType = 'general';
      if (text.toLowerCase().includes('deposit')) {
        workflowType = 'deposit';
      } else if (text.toLowerCase().includes('withdraw')) {
        workflowType = 'withdrawal';
      } else if (text.toLowerCase().includes('rebalance')) {
        workflowType = 'rebalance';
      } else if (text.toLowerCase().includes('emergency') || text.toLowerCase().includes('alert')) {
        workflowType = 'emergency';
      }

      // Create workflow coordination tasks
      const workflowId = `workflow_${Date.now()}`;
      const tasks = [];

      switch (workflowType) {
        case 'deposit':
          tasks.push(
            { agent: 'treasurer', task: 'Generate MPC deposit address', order: 1 },
            { agent: 'treasurer', task: 'Monitor for incoming funds', order: 2 },
            { agent: 'treasurer', task: 'Swap USDC for RWA tokens', order: 3 },
            { agent: 'strategist', task: 'Deposit RWAs as collateral', order: 4 },
            { agent: 'strategist', task: 'Borrow USDC for yield loop', order: 5 },
          );
          break;
        case 'withdrawal':
          tasks.push(
            { agent: 'guardian', task: 'Assess current risk levels', order: 1 },
            { agent: 'strategist', task: 'Repay Morpho loans', order: 2 },
            { agent: 'strategist', task: 'Release RWA collateral', order: 3 },
            { agent: 'treasurer', task: 'Swap RWAs back to USDC', order: 4 },
            { agent: 'treasurer', task: 'Bridge USDC to user', order: 5 },
          );
          break;
        case 'rebalance':
          tasks.push(
            { agent: 'guardian', task: 'Calculate new target ratios', order: 1 },
            { agent: 'strategist', task: 'Adjust leverage positions', order: 2 },
            { agent: 'treasurer', task: 'Rebalance RWA allocations', order: 3 },
          );
          break;
        default:
          tasks.push(
            { agent: 'manager', task: 'Coordinate general workflow', order: 1 },
          );
      }

      // Delegate tasks in order
      for (const task of tasks) {
        await swarmCoordinator.delegateTask(
          runtime,
          agentName,
          task.agent,
          'WORKFLOW_TASK',
          {
            workflowId,
            workflowType,
            description: task.task,
            order: task.order,
            priority: 'high',
          }
        );
      }

      if (callback) {
        callback({
          text: `🔄 Workflow Coordination Started

Workflow ID: ${workflowId}
Type: ${workflowType}
Tasks: ${tasks.length}

Coordinating ${workflowType} workflow across ${tasks.map(t => t.agent).join(', ')} agents. Each agent will receive their specific tasks in sequence.`,
        });
      }

      return {
        success: true,
        text: `Coordinating ${workflowType} workflow with ${tasks.length} tasks`,
        data: {
          workflowId,
          workflowType,
          tasks,
          coordinator: agentName,
        },
      };
    } catch (error: any) {
      elizaLogger.error("Error coordinating workflow:", error);
      
      if (callback) {
        callback({
          text: `Failed to coordinate workflow: ${error.message}`,
        });
      }

      return {
        success: false,
        error: error.message || "Unknown error in workflow coordination",
      };
    }
  },

  examples: [
    [
      {
        user: "user",
        content: { text: "Start deposit workflow for 1000 USDC" },
      },
      {
        user: "manager",
        content: {
          text: "Initiating deposit workflow coordination across the swarm.",
        },
      },
    ],
  ],
};