import type { ArenaBoard, ArenaEntry } from "../types";

const BASE = "https://arena.ai/leaderboard";

/**
 * Arena's board slugs. "" is the general chat board; "code" is the WebDev board —
 * note that /leaderboard/code and /leaderboard/code/webdev serve byte-identical
 * entries and the page titles itself "WebDev AI Leaderboard", so there is exactly
 * one coding board here, not a parent with children.
 */
export const ARENA_BOARDS = {
  text: { slug: "text-overall", path: "" },
  webdev: { slug: "code-webdev", path: "/code" },
} as const;

/**
 * Scrapes an arena.ai human-preference leaderboard.
 *
 * Arena has NO measured cost, output tokens, or agent steps — it is human-vote Elo,
 * so it can never drive the cost side of the ranking. What it does supply is the
 * one thing DeepSWE cannot: whether a human actually prefers the code that came
 * out. That is the Craft axis. See lib/score.ts for why that is a separate gate.
 *
 * Data lives in the Next.js RSC flight payload, split across many
 * self.__next_f.push([1,"<chunk>"]) calls that must be concatenated first.
 */
export async function fetchArena(
  board: keyof typeof ARENA_BOARDS = "text",
  html?: string,
): Promise<ArenaBoard> {
  const { slug, path } = ARENA_BOARDS[board];
  const sourceUrl = `${BASE}${path}`;
  const source = html ?? (await fetchText(sourceUrl));
  const flight = reassembleFlight(source);
  const entries = extractEntries(flight);
  validate(entries);
  return { sourceUrl, slug, entries };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Arena: HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function reassembleFlight(html: string): string {
  const parts = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)];
  if (!parts.length) throw new Error("Arena: no RSC flight payload found — page structure changed");
  return parts.map((m) => JSON.parse(m[1]) as string).join("");
}

function extractEntries(flight: string): ArenaEntry[] {
  const marker = flight.indexOf('"entries":[');
  if (marker === -1) throw new Error("Arena: entries array not found — page structure changed");

  const start = flight.indexOf("[", marker + '"entries":'.length);
  let depth = 0;
  let end = -1;
  for (let i = start; i < flight.length; i++) {
    if (flight[i] === "[") depth++;
    else if (flight[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error("Arena: unbalanced brackets in entries array");

  const raw = JSON.parse(flight.slice(start, end + 1)) as Record<string, unknown>[];
  return raw.map((e) => ({
    rank: Number(e.rank),
    modelDisplayName: String(e.modelDisplayName ?? ""),
    rating: Number(e.rating),
    ratingLower: Number(e.ratingLower ?? e.rating),
    ratingUpper: Number(e.ratingUpper ?? e.rating),
    votes: Number(e.votes ?? 0),
    organization: e.modelOrganization ? String(e.modelOrganization) : null,
    license: e.license ? String(e.license) : null,
    modelUrl: e.modelUrl ? String(e.modelUrl) : null,
    inputPricePerMillion: typeof e.inputPricePerMillion === "number" ? e.inputPricePerMillion : null,
    outputPricePerMillion: typeof e.outputPricePerMillion === "number" ? e.outputPricePerMillion : null,
    contextLength: typeof e.contextLength === "number" ? e.contextLength : null,
  }));
}

function validate(entries: ArenaEntry[]) {
  if (entries.length < 50) {
    throw new Error(`Arena: only ${entries.length} entries parsed, expected >= 50`);
  }
  for (const e of entries) {
    if (!e.modelDisplayName) throw new Error("Arena: entry with no model name");
    if (!Number.isFinite(e.rating)) throw new Error(`Arena: bad rating for ${e.modelDisplayName}`);
  }
}
