import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import starterPlugin from './plugin.ts';

// Import character definitions for the swarm
import { managerCharacter } from './characters/manager.ts';
import { treasurerCharacter } from './characters/treasurer.ts';
import { strategistCharacter } from './characters/strategist.ts';
import { guardianCharacter } from './characters/guardian.ts';

// Import existing plugins
import { arcPlugin } from '@elizaos/plugin-arc';
import { ensPlugin } from '@elizaos/plugin-ens';
import { defiNewsPlugin } from '../plugin-defi-news-1.x/src/index.ts';
import { uniswapPlugin } from '@elizaos/plugin-uniswap';
import { morphoPlugin } from '../plugin-morpho/src/index.ts';
import { circlePlugin } from '../plugin-circle/src/index.ts';
import { solanaPlugin } from '../plugin-solana/src/index.ts';
import { swarmPlugin } from '../plugin-swarm/src/index.ts';

// Import swarm coordinator service
import { swarmCoordinator } from './services/swarmCoordinator.ts';

const initSwarmAgent = (agentName: string) => async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info(`Initializing ${agentName} agent`);
  
  // Initialize swarm coordinator for all agents
  await swarmCoordinator.initialize(runtime);
  
  logger.info(`${agentName} agent initialized with swarm coordination`);
};

// Manager Agent - User Interface Coordinator
export const managerAgent: ProjectAgent = {
  character: managerCharacter,
  init: initSwarmAgent('Manager'),
  plugins: [
    starterPlugin,
    swarmPlugin, // Swarm coordination
  ],
};

// Treasurer Agent - Bridge & Funding Operations  
export const treasurerAgent: ProjectAgent = {
  character: treasurerCharacter,
  init: initSwarmAgent('Treasurer'),
  plugins: [
    starterPlugin,
    arcPlugin,
    ensPlugin,
    uniswapPlugin,
    circlePlugin, // Enhanced Circle integration
    solanaPlugin, // Solana blockchain operations
    swarmPlugin, // Swarm coordination
  ],
};

// Strategist Agent - Lending & Leverage Management
export const strategistAgent: ProjectAgent = {
  character: strategistCharacter,
  init: initSwarmAgent('Strategist'),
  plugins: [
    starterPlugin,
    morphoPlugin,
    swarmPlugin, // Swarm coordination
  ],
};

// Guardian Agent - Risk & News Monitoring
export const guardianAgent: ProjectAgent = {
  character: guardianCharacter,
  init: initSwarmAgent('Guardian'),
  plugins: [
    starterPlugin,
    defiNewsPlugin,
    swarmPlugin, // Swarm coordination
  ],
};

// Multi-Agent Swarm Project
const project: Project = {
  agents: [
    managerAgent,    // User interface coordinator
    treasurerAgent,  // Bridge & funding operations
    strategistAgent, // Lending & leverage management
    guardianAgent,   // Risk monitoring & news analysis
  ],
};

// Export characters for external use
export { managerCharacter } from './characters/manager.ts';
export { treasurerCharacter } from './characters/treasurer.ts';
export { strategistCharacter } from './characters/strategist.ts';
export { guardianCharacter } from './characters/guardian.ts';

// Export swarm coordinator
export { swarmCoordinator } from './services/swarmCoordinator.ts';

export default project;
