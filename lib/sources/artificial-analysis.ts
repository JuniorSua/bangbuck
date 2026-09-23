import type { AaAgentRow, AaData, AaModel } from "../types";

const BASE = "https://artificialanalysis.ai";
/** Every model page embeds all ~670 model records; this one is the least likely to vanish. */
const MODELS_PAGE = `${BASE}/models/gpt-6-astra`;

/**
 * Scrapes Artificial Analysis: an independent lab that runs every model through
 * the same test suite and publishes score, price, cost to run, tokens and speed.
 *
 * It is a second opinion, never an input to the ranking. Its cost per task is
 * for its own mixed suite (science, maths, agents, code), not real repo tasks,
 * so dividing BangBuck's Ship by it would mix two different kinds of work.
 *
 * No key needed: the public pages carry the data in the same Next.js flight
 * payload Arena uses. The keyed API omits cost to run, tokens and the Coding
 * Agent Index, which are the parts worth having. The field names are AA's
 * internal ones and can change without notice, so validate() fails loudly.
 */
export async function fetchArtificialAnalysis(pages?: { models: string; home: string }): Promise<AaData> {
  const models = extractModels(flight(pages?.models ?? (await fetchText(MODELS_PAGE))));
  const codingAgents = extractAgents(flight(pages?.home ?? (await fetchText(BASE))));
  validate(models, codingAgents);
  return { sourceUrl: `${BASE}/leaderboards/models`, models, codingAgents };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/131.0", accept: "text/html" } });
  if (!res.ok) throw new Error(`Artificial Analysis: HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function flight(html: string): string {
  const parts = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)];
  if (!parts.length) throw new Error("Artificial Analysis: no flight payload — page structure changed");
  return parts.map((m) => JSON.parse(m[1]) as string).join("");
}

/** Parses the JSON object that opens at `start`, skipping braces inside strings. */
function objectAt(s: string, start: number): Record<string, unknown> | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try {
        return JSON.parse(s.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function extractModels(s: string): AaModel[] {
  // The same record appears in several shapes; the full one is the longest.
  const full = new Map<string, Rec>();
  for (const m of s.matchAll(/\{"id":"[0-9a-f-]{36}","slug":"/g)) {
    const o = objectAt(s, m.index!) as Rec | null;
    if (!o || !("intelligenceIndex" in o) || !("price1mBlended0To3To1" in o)) continue;
    const prev = full.get(o.slug);
    if (!prev || Object.keys(o).length > Object.keys(prev).length) full.set(o.slug, o);
  }
  return [...full.values()]
    // Estimated scores are AA's guesses from partial runs; retired models are noise.
    .filter((o) => num(o.intelligenceIndex) !== null && !o.intelligenceIndexIsEstimated && !o.deprecated)
    .map((o) => ({
      slug: o.slug,
      name: o.release?.name ?? o.name,
      creator: o.creator?.name ?? null,
      family: o.release?.slug ?? o.slug,
      effort: o.effort?.slug ?? null,
      releaseDate: o.releaseDate ?? null,
      intelligence: o.intelligenceIndex,
      terminalBench: num(o.terminalBench40),
      priceIn: num(o.price1mInputTokens),
      priceOut: num(o.price1mOutputTokens),
      costPerTask: num(o.intelligenceIndexCostPerTask?.cost?.total),
      outputTokensPerTask: num(o.intelligenceIndexOutputTokensPerTask?.output),
      // Medium prompt, matching the API default. The leaderboard's own speed
      // column matches no single prompt type, so it is not used.
      outputSpeed: num(o.performanceByPromptType?.medium?.medianOutputSpeed),
    }))
    .sort((a, b) => b.intelligence - a.intelligence);
}

function extractAgents(s: string): AaAgentRow[] {
  const at = s.indexOf('{"rows":[');
  const table = at === -1 ? null : (objectAt(s, at) as Rec | null);
  if (!table) throw new Error("Artificial Analysis: Coding Agent Index table not found");
  const reward = (r: Rec, key: string) => num(r.evals?.find((e: Rec) => e.datasetIndexName === key)?.mean?.reward);
  return (table.rows as Rec[])
    .filter((r) => num(r.indexScore) !== null && !r.isUnavailable)
    .map((r) => ({
      agent: r.display?.agent ?? r.agentName,
      creator: r.display?.creator?.model ?? null,
      model: r.display?.model ?? r.displayLabel,
      score: r.indexScore * 100,
      costPerTask: num(r.mean?.costUsd),
      deepswe: reward(r, "deep-swe-v1.1"),
      terminalBench: reward(r, "terminal-bench-v4"),
    }))
    .sort((a, b) => b.score - a.score);
}

function validate(models: AaModel[], agents: AaAgentRow[]) {
  if (models.length < 50) throw new Error(`Artificial Analysis: only ${models.length} models parsed, expected >= 50`);
  if (!models.some((m) => m.family === "gpt-6-astra" && m.costPerTask !== null)) {
    throw new Error("Artificial Analysis: gpt-6-astra missing or has no cost — field names changed");
  }
  if (agents.length < 5) throw new Error(`Artificial Analysis: only ${agents.length} coding-agent rows parsed`);
}
