import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import starterPlugin from './plugin.ts';
import { character } from './character.ts';

import { arcPlugin } from '@elizaos/plugin-arc';
import { ensPlugin } from '@elizaos/plugin-ens';
// import { kaminoPlugin } from '../plugin-kamino/src/index.ts';
import { defiNewsPlugin } from '../plugin-defi-news-1.x/src/index.ts';
import { uniswapPlugin } from '@elizaos/plugin-uniswap';
import { morphoPlugin } from '../plugin-morpho/src/index.ts';

const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('Initializing character');
  logger.info({ name: character.name }, 'Name:');
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [starterPlugin, arcPlugin, ensPlugin, defiNewsPlugin, uniswapPlugin, morphoPlugin],
};

const project: Project = {
  agents: [projectAgent],
};

export { character } from './character.ts';

export default project;
