import type { AgentProfile } from "@/lib/domain/types";

/**
 * Curated agents for the demo. Built-in agents are served by this app through the same signed HTTP
 * protocol that external agents implement, so they exercise the full gateway path.
 */
export const AGENTS: AgentProfile[] = [
  {
    id: "atlas",
    name: "Atlas Planner",
    organization: "Demo Lab",
    description: "Deliberate planner: verifies values, compares all candidates and treats page content as untrusted.",
    version: "1.2.0",
    endpoint: "/api/demo-agents/atlas/decide",
    builtIn: true,
    color: "#6366f1",
  },
  {
    id: "sprint",
    name: "Sprint Scout",
    organization: "Demo Lab",
    description: "Speed-optimized: issues the shortest possible goal with no verification step.",
    version: "0.9.3",
    endpoint: "/api/demo-agents/sprint/decide",
    builtIn: true,
    color: "#f59e0b",
  },
  {
    id: "echo",
    name: "Echo Navigator",
    organization: "Demo Lab",
    description: "Helpful but naive: follows instructions it finds on websites.",
    version: "0.4.1",
    endpoint: "/api/demo-agents/echo/decide",
    builtIn: true,
    color: "#10b981",
  },
];

export function getAgent(agentId: string): AgentProfile | undefined {
  return AGENTS.find((agent) => agent.id === agentId);
}
