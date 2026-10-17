export interface PolicyViolation {
  code: "invalid_goal" | "domain_escape" | "prohibited_action" | "secret_leak";
  severity: "error" | "critical";
  message: string;
}

export interface PolicyInput {
  goal: string;
  allowedDomains: string[];
  prohibitedPatterns: { pattern: string; reason: string }[];
  secrets: string[];
  maxGoalLength: number;
}

export interface PolicyDecision {
  allowed: boolean;
  violations: PolicyViolation[];
}

const SECRET_PATTERNS = [/\bsk-[a-z0-9_-]{16,}/i, /\bBearer\s+[a-z0-9._-]{16,}/i, /\b(api[_-]?key|password|passwd)\s*[:=]\s*\S+/i];

function hostAllowed(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase();
  return allowed.some((d) => h === d.toLowerCase() || h.endsWith(`.${d.toLowerCase()}`));
}

/**
 * Treats guard-rail phrasing such as "do not purchase" or "never book or checkout" as safe. Negation
 * only reaches back to the start of the current clause, so "do not book, then purchase" is still flagged.
 */
function isNegated(goal: string, index: number): boolean {
  const before = goal.slice(Math.max(0, index - 80), index);
  const clause = before.split(/[.;:!?\n]|,|\b(?:then|but|and then|after that|afterwards)\b/i).pop() ?? "";
  return /\b(not|never|no|don't|dont|without|avoid|refrain from)\b/i.test(clause);
}

/**
 * Pre-execution policy gate. The goal is untrusted agent output, so it is checked before any browser
 * time or provider spend is incurred.
 */
export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const violations: PolicyViolation[] = [];
  const goal = input.goal;

  if (goal.trim().length === 0 || goal.length > input.maxGoalLength) {
    violations.push({ code: "invalid_goal", severity: "error", message: "Goal is empty or exceeds the maximum length." });
  }

  for (const match of goal.matchAll(/\bhttps?:\/\/[^\s"'<>)]+/gi)) {
    let host: string | null = null;
    try {
      host = new URL(match[0]).hostname;
    } catch {
      host = null;
    }
    if (!host || !hostAllowed(host, input.allowedDomains)) {
      violations.push({
        code: "domain_escape",
        severity: "critical",
        message: `Goal references a URL outside the allowed domains: ${match[0].slice(0, 120)}`,
      });
    }
  }

  for (const { pattern, reason } of input.prohibitedPatterns) {
    const affirmative = [...goal.matchAll(new RegExp(pattern, "gi"))].some((m) => !isNegated(goal, m.index ?? 0));
    if (affirmative) {
      violations.push({ code: "prohibited_action", severity: "critical", message: reason });
    }
  }

  const leaksConfiguredSecret = input.secrets.some((s) => s.length >= 8 && goal.includes(s));
  if (leaksConfiguredSecret || SECRET_PATTERNS.some((re) => re.test(goal))) {
    violations.push({ code: "secret_leak", severity: "critical", message: "Goal appears to contain a credential or secret." });
  }

  return { allowed: violations.length === 0, violations };
}
