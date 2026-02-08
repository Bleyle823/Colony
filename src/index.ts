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
import { solanaPlugin } from '../plugin-solana/src/index.ts';
import openRouterPlugin from '@elizaos/plugin-openrouter';

const initSwarmAgent = (agentName: string) => async (runtime: IAgentRuntime) => {
  logger.info(`Initializing ${agentName} agent`);
  logger.info(`${agentName} agent initialized`);
};

// Manager Agent - User Interface Coordinator
export const managerAgent: ProjectAgent = {
  character: managerCharacter,
  init: initSwarmAgent('Manager'),
  plugins: [
    '@elizaos/plugin-sql',        // Database/memory
    '@elizaos/plugin-bootstrap',  // Core actions
    starterPlugin,
    openRouterPlugin, // AI model provider
  ],
};

// Treasurer Agent - Bridge & Funding Operations  
export const treasurerAgent: ProjectAgent = {
  character: treasurerCharacter,
  init: initSwarmAgent('Treasurer'),
  plugins: [
    '@elizaos/plugin-sql',        // Database/memory
    '@elizaos/plugin-bootstrap',  // Core actions
    starterPlugin,
    openRouterPlugin, // AI model provider
    arcPlugin,
    ensPlugin,
    uniswapPlugin,
    solanaPlugin,
  ],
};

// Strategist Agent - Lending & Leverage Management
export const strategistAgent: ProjectAgent = {
  character: strategistCharacter,
  init: initSwarmAgent('Strategist'),
  plugins: [
    '@elizaos/plugin-sql',        // Database/memory
    '@elizaos/plugin-bootstrap',  // Core actions
    starterPlugin,
    openRouterPlugin, // AI model provider
    morphoPlugin,
  ],
};

// Guardian Agent - Risk & News Monitoring
export const guardianAgent: ProjectAgent = {
  character: guardianCharacter,
  init: initSwarmAgent('Guardian'),
  plugins: [
    '@elizaos/plugin-sql',        // Database/memory
    '@elizaos/plugin-bootstrap',  // Core actions
    starterPlugin,
    openRouterPlugin, // AI model provider
    defiNewsPlugin,
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

export default project;
