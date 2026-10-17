import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AGENTS } from "@/lib/catalog/agents";
import { AGENT_PROTOCOL_VERSION } from "@/lib/agents/protocol";

export const metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Registered agents"
        subtitle="Agents are external HTTP services. For each attempt the platform sends the task; the agent returns a strategy (goal) that TinyFish executes."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {AGENTS.map((agent) => (
          <Card key={agent.id}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: agent.color }} />
              <Link href={`/agents/${agent.id}`} className="font-semibold hover:underline">
                {agent.name}
              </Link>
              {agent.builtIn && <Badge>demo</Badge>}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {agent.organization} · v{agent.version}
            </p>
            <p className="mt-3 text-sm">{agent.description}</p>
            <p className="mt-3 truncate font-mono text-xs text-zinc-500">{agent.endpoint}</p>
          </Card>
        ))}
      </div>
      <Card title={`Agent protocol v${AGENT_PROTOCOL_VERSION}`} className="mt-6">
        <p className="text-sm">
          The platform sends a signed <code className="rounded bg-zinc-100 px-1">POST</code> with headers{" "}
          <code className="rounded bg-zinc-100 px-1">x-olympics-timestamp</code> and <code className="rounded bg-zinc-100 px-1">x-olympics-signature</code>{" "}
          (HMAC-SHA256 of <code className="rounded bg-zinc-100 px-1">{"`${timestamp}.${body}`"}</code>). Respond within 20 seconds with:
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-zinc-50 p-3 text-xs">{`{
  "action": "execute",          // or "abort" with "abortReason"
  "agentVersion": "1.0.0",
  "goal": "natural-language instructions for the browser",
  "rationale": "optional short explanation"
}`}</pre>
        <p className="mt-3 text-xs text-zinc-500">
          Unknown fields are rejected. The platform appends its own output contract and executes the goal in TinyFish; agents never receive browser credentials.
          To add an agent today, register it in <code>src/lib/catalog/agents.ts</code>.
        </p>
      </Card>
    </>
  );
}
