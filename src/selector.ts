import { checkbox } from "@inquirer/prompts";
import type { AgentProcess } from "./types.js";

export async function selectAgents(
  agents: AgentProcess[]
): Promise<AgentProcess[]> {
  if (agents.length === 0) {
    return [];
  }

  const choices = agents.map((agent) => ({
    name: `${agent.cwd} (pid ${agent.pid}, ${agent.type})`,
    value: agent,
    checked: false,
  }));

  const selected = await checkbox({
    message: "Select agent processes to connect:",
    choices,
  });

  return selected;
}
