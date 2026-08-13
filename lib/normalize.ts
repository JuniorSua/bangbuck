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
  // Arena sometimes date-stamps an entry ("deepseek-v4-pro-max-20260813"). The
  // date is a snapshot tag, not part of the model's identity, and it must be
  // stripped BEFORE the effort suffix, which it otherwise hides.
  const withoutDate = withoutHarness.replace(/[-_]\d{8}$/, "");
  const withoutEffort = withoutDate.replace(/[-_](low|medium|high|xhigh|max|thinking)$/i, "");
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

/** Reasoning efforts in ascending order, used to measure "nearness" between configs. */
export const EFFORT_ORDER = ["low", "medium", "high", "xhigh", "max"] as const;

/** Where a config's Craft rating came from, so the UI can be honest about it. */
export type CraftMatch =
  /** Arena rates this exact model AND effort. */
  | { kind: "exact"; entry: ArenaEntry }
  /** Arena rates the family but not this effort; nearest effort was used. */
  | { kind: "family"; entry: ArenaEntry; borrowedFrom: string }
  | { kind: "none" };

/**
 * Resolves a DeepSWE config to a WebDev Elo, preferring an exact model+effort match
 * and otherwise borrowing the family's nearest-effort entry.
 *
 * Borrowing is defensible because the two axes divide the work cleanly: reasoning
 * effort shows up on the Ship axis, which is measured per config, while Craft is
 * mostly a property of the model itself — its taste in code does not change when
 * you let it think longer. Nearest-effort rather than best-rated matters, though:
 * taking the family's top entry would hand a [low] config its [max] sibling's
 * rating, which flatters exactly the configs least deserving of it.
 *
 * Only 12 of 50 configs match exactly, so the distinction is not academic and
 * every row surfaces its own provenance.
 */
export function craftFor(config: DeepSweConfig, entries: ArenaEntry[]): CraftMatch {
  const family = familyKey(config.model);
  const candidates = entries
    .map((entry) => ({ entry, ...describe(entry.modelDisplayName) }))
    .filter((c) => c.family === family);
  if (!candidates.length) return { kind: "none" };

  const exact = candidates.find((c) => c.effort === config.effort);
  if (exact) return { kind: "exact", entry: exact.entry };

  const target = EFFORT_ORDER.indexOf(config.effort as (typeof EFFORT_ORDER)[number]);
  const nearest = candidates.slice().sort((a, b) => distance(a, target) - distance(b, target) || b.entry.rating - a.entry.rating)[0];
  return { kind: "family", entry: nearest.entry, borrowedFrom: nearest.effort ?? "unrated" };
}

function distance(c: { effort: string | null }, target: number): number {
  if (c.effort === null || target === -1) return 9;
  return Math.abs(EFFORT_ORDER.indexOf(c.effort as (typeof EFFORT_ORDER)[number]) - target);
}

/** Splits an Arena display name into its family key and its effort suffix, if any. */
function describe(displayName: string): { family: string; effort: string | null } {
  const withoutHarness = displayName.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
  // Same date-stamp rule as familyKey, and it must run BEFORE the effort parse:
  // "…-max-20260813" hides its effort suffix behind the date.
  const withoutDate = withoutHarness.replace(/[-_]\d{8}$/, "");
  const match = /^(.*?)[-_](low|medium|high|xhigh|max)$/.exec(withoutDate);
  const base = (match ? match[1] : withoutDate).replace(/[-_]thinking$/, "");
  return { family: base.replace(/[^a-z0-9]/g, ""), effort: match ? match[2] : null };
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
