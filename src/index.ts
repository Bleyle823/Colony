import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import { managerCharacter } from './characters/manager.ts';
import { treasurerCharacter } from './characters/treasurer.ts';
import { strategistCharacter } from './characters/strategist.ts';
import { guardianCharacter } from './characters/guardian.ts';
import { arcPlugin } from "../plugin-arc/src/index.js";
import { ensPlugin } from "../plugin-ens/src/index.js";
import { kaminoPlugin } from "../plugin-kamino/src/index.js";
import { defiNewsPlugin } from "../plugin-defi-news-1.x/src/index.js";
import { openrouterPlugin } from "@elizaos/plugin-openrouter";

const initAgent = (name: string) => async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info(`Initializing ${name} agent...`);
};

export const managerAgent: ProjectAgent = {
  character: managerCharacter,
  plugins: [openrouterPlugin],
  init: initAgent("Manager"),
};

export const treasurerAgent: ProjectAgent = {
  character: treasurerCharacter,
  plugins: [openrouterPlugin, arcPlugin, ensPlugin],
  init: initAgent("Treasurer"),
};

export const strategistAgent: ProjectAgent = {
  character: strategistCharacter,
  plugins: [openrouterPlugin, kaminoPlugin],
  init: initAgent("Strategist"),
};

export const guardianAgent: ProjectAgent = {
  character: guardianCharacter,
  plugins: [openrouterPlugin, defiNewsPlugin],
  init: initAgent("Guardian"),
};

const project: Project = {
  agents: [managerAgent, treasurerAgent, strategistAgent, guardianAgent],
};

export default project;
