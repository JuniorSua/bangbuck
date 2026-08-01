import type { ArenaEntry, DeepSweConfig } from "./types";

/**
 * Collapses a model name to a comparable key: lowercase alphanumerics only,
 * with any trailing reasoning-effort suffix removed.
 *
 * "gpt-5-6-luna"                    -> "gpt56luna"
 * "gpt-5.6-luna-xhigh"              -> "gpt56luna"
 * "gpt-5.6-luna-xhigh (codex-harness)" -> "gpt56luna"
 */
export function familyKey(name: string): string {
  const withoutHarness = name.replace(/\s*\(.*\)\s*$/, "");
  const withoutEffort = withoutHarness.replace(/[-_](low|medium|high|xhigh|max|thinking)$/i, "");
  return withoutEffort.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Joins DeepSWE configs to Arena entries at the MODEL FAMILY level, not config level.
 *
 * Config-level joins are not possible: Arena carries gpt-5.6-luna-xhigh but not -max,
 * and claude-opus-5-high/-max but not -medium. Where a family has several Arena
 * entries we keep the highest-rated one.
 *
 * Returns a map from familyKey -> best Arena entry. Families with no Arena presence
 * are simply absent; callers must render "—", never zero.
 */
export function buildArenaIndex(entries: ArenaEntry[]): Map<string, ArenaEntry> {
  const index = new Map<string, ArenaEntry>();
  for (const entry of entries) {
    const key = familyKey(entry.modelDisplayName);
    const existing = index.get(key);
    if (!existing || entry.rating > existing.rating) index.set(key, entry);
  }
  return index;
}

export function arenaFor(
  config: DeepSweConfig,
  index: Map<string, ArenaEntry>,
): ArenaEntry | null {
  return index.get(familyKey(config.model)) ?? null;
}

/** "gpt-5.6-luna [max]" */
export function configLabel(c: DeepSweConfig): string {
  return c.effort ? `${c.modelDisplay} [${c.effort}]` : c.modelDisplay;
}

/**
 * Fallback only — Arena's own `organization` wins when present. These match
 * Arena's values so the two paths agree: grok ships under "SpaceXAI" and
 * muse-spark under "Meta", neither of which you would guess from the name.
 */
const ORG_BY_PREFIX: [RegExp, string][] = [
  [/^claude/, "Anthropic"],
  [/^gpt/, "OpenAI"],
  [/^gemini/, "Google"],
  [/^kimi/, "Moonshot"],
  [/^grok/, "SpaceXAI"],
  [/^glm/, "Z.ai"],
  [/^muse/, "Meta"],
];

export function organizationFor(c: DeepSweConfig, arena: ArenaEntry | null): string {
  if (arena?.organization) return arena.organization;
  for (const [pattern, org] of ORG_BY_PREFIX) {
    if (pattern.test(c.model)) return org;
  }
  return "Unknown";
}
