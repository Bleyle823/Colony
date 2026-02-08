import {
  IAgentRuntime,
  Provider,
  Memory,
  State,
  elizaLogger,
} from "@elizaos/core";
import { swarmCoordinator } from "../../../src/services/swarmCoordinator";

/**
 * Swarm Status Provider
 * 
 * Provides context about pending tasks, coordination messages,
 * and swarm-wide status for agents to make informed decisions.
 */
export const swarmStatusProvider: Provider = {
  name: "swarm_status_provider",
  description: "Provides swarm coordination status and pending tasks",
  position: -1, // High priority - run early for coordination context

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ) => {
    try {
      const agentName = runtime.character?.name?.toLowerCase() || 'unknown';
      
      // Get pending tasks for this agent
      const pendingTasks = await swarmCoordinator.getPendingTasks(runtime, agentName);
      
      // Get recent coordination messages
      const coordinationMessages = await swarmCoordinator.getCoordinationMessages(
        runtime, 
        'coordination', 
        5
      );

      // Get recent alerts
      const alertMessages = await swarmCoordinator.getCoordinationMessages(
        runtime,
        'alerts',
        3
      );

      let contextText = '';

      // Add pending tasks context
      if (pendingTasks.length > 0) {
        contextText += `\n🔄 PENDING TASKS (${pendingTasks.length}):\n`;
        pendingTasks.forEach((task, index) => {
          contextText += `${index + 1}. ${task.taskType}: ${task.payload?.description || 'No description'}\n`;
          contextText += `   From: ${task.fromAgent} | Priority: ${task.payload?.priority || 'normal'}\n`;
        });
      }

      // Add recent coordination context
      if (coordinationMessages.length > 0) {
        contextText += `\n📡 RECENT COORDINATION:\n`;
        coordinationMessages.slice(0, 3).forEach((msg) => {
          if (msg.content?.metadata) {
            const meta = msg.content.metadata;
            if (meta.taskType) {
              contextText += `• ${meta.fromAgent} → ${meta.toAgent}: ${meta.taskType}\n`;
            }
          }
        });
      }

      // Add alert context
      if (alertMessages.length > 0) {
        contextText += `\n🚨 RECENT ALERTS:\n`;
        alertMessages.forEach((msg) => {
          if (msg.content?.metadata) {
            const meta = msg.content.metadata;
            contextText += `• ${meta.severity?.toUpperCase()}: ${meta.message}\n`;
          }
        });
      }

      // Add agent role context
      const roleContext = getRoleContext(agentName);
      if (roleContext) {
        contextText += `\n🎯 ROLE CONTEXT:\n${roleContext}\n`;
      }

      return {
        text: contextText,
        values: {
          pendingTasksCount: pendingTasks.length,
          hasAlerts: alertMessages.length > 0,
          agentRole: agentName,
          coordinationActive: coordinationMessages.length > 0,
        },
      };
    } catch (error) {
      elizaLogger.error("Error in swarm status provider:", error);
      return {
        text: "",
        values: {},
      };
    }
  },
};

/**
 * Portfolio State Provider
 * 
 * Provides current portfolio state context for decision making
 */
export const portfolioStateProvider: Provider = {
  name: "portfolio_state_provider", 
  description: "Provides current portfolio state and metrics",
  position: 0, // Normal priority

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ) => {
    try {
      // For now, return mock portfolio data
      // In production, this would fetch real portfolio state
      const mockPortfolioState = {
        totalUsdcValue: 2500.00,
        rwaPositions: {
          'mF-ONE': { amount: 1200, value: 1200 },
          'GLDx': { amount: 800, value: 850 },
        },
        leverageRatio: 2.8,
        healthFactor: 1.25,
        lastUpdated: new Date().toISOString(),
      };

      const contextText = `
💰 PORTFOLIO STATE:
• Total Value: $${mockPortfolioState.totalUsdcValue.toLocaleString()}
• Leverage Ratio: ${mockPortfolioState.leverageRatio}x
• Health Factor: ${mockPortfolioState.healthFactor}
• RWA Positions: mF-ONE ($${mockPortfolioState.rwaPositions['mF-ONE'].value}), GLDx ($${mockPortfolioState.rwaPositions['GLDx'].value})
• Status: ${mockPortfolioState.healthFactor > 1.2 ? 'HEALTHY' : 'AT RISK'}
`;

      return {
        text: contextText,
        values: {
          totalValue: mockPortfolioState.totalUsdcValue,
          leverageRatio: mockPortfolioState.leverageRatio,
          healthFactor: mockPortfolioState.healthFactor,
          isHealthy: mockPortfolioState.healthFactor > 1.2,
          rwaPositions: mockPortfolioState.rwaPositions,
        },
      };
    } catch (error) {
      elizaLogger.error("Error in portfolio state provider:", error);
      return {
        text: "",
        values: {},
      };
    }
  },
};

/**
 * Get role-specific context for agents
 */
function getRoleContext(agentName: string): string {
  switch (agentName) {
    case 'manager':
      return 'Coordinate user requests and aggregate team reports. Route tasks to specialized agents.';
    case 'treasurer':
      return 'Handle cross-chain operations, RWA acquisition, and fund custody. Monitor gas and bridge operations.';
    case 'strategist':
      return 'Manage Morpho positions, leverage ratios, and yield optimization. Respond to Guardian alerts.';
    case 'guardian':
      return 'Monitor risks, news feeds, and health factors. Issue alerts when thresholds are breached.';
    default:
      return '';
  }
}