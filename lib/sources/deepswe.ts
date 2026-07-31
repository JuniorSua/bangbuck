import type { DeepSweConfig } from "../types";

const SOURCE_URL = "https://deepswe.datacurve.ai/";

/**
 * Scrapes the DeepSWE leaderboard.
 *
 * IMPORTANT — do not "simplify" this to fetch the artifact JSON at
 * /artifacts/v1.1/leaderboard-live.json. That endpoint returns HTTP 200 and looks
 * authoritative, but it is CDN-cached with outdated pricing: it reports
 * gpt-5-6-luna [max] at $3.028 when the live price is $0.6056 (a 5x price cut).
 * Cache-busting does not help. Only these two models currently differ, so the bug
 * is easy to miss and silently produces the wrong winner.
 *
 * The live data lives in the largest inline <script> on the homepage, as a
 * seroval-serialised TanStack Query cache (unquoted object keys, $R[n]= backrefs).
 */
export async function fetchDeepSwe(html?: string) {
  const source = html ?? (await fetchText(SOURCE_URL));
  const script = largestInlineScript(source);
  const rows = extractLeaderboardRows(script);
  const meta = extractMeta(script);

  const configs = rows.map(toConfig);
  validate(configs);

  return {
    generatedAt: meta.generatedAt,
    nTasksInSet: meta.nTasksInSet,
    latestJob: meta.latestJob,
    sourceUrl: SOURCE_URL,
    configs,
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // Without a browser-ish UA some edges return a challenge page.
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`DeepSWE: HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function largestInlineScript(html: string): string {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!scripts.length) throw new Error("DeepSWE: no inline <script> found — page structure changed");
  return scripts.reduce((a, b) => (b.length > a.length ? b : a));
}

/** Matches the closing bracket for the opener at `start`. */
function matchBracket(s: string, start: number, open = "[", close = "]"): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("DeepSWE: unbalanced brackets in payload");
}

/** Turns a seroval object-literal fragment into JSON. */
function serovalToJson(blob: string): unknown {
  const cleaned = blob
    .replace(/\$R\[\d+\]=/g, "")
    .replace(/([{,])([A-Za-z_][A-Za-z0-9_]*):/g, '$1"$2":');
  return JSON.parse(cleaned);
}

type RawRow = Record<string, unknown>;

function extractLeaderboardRows(script: string): RawRow[] {
  // Two `rows:` arrays exist in the payload (task definitions and the leaderboard).
  // Only the leaderboard carries cost data.
  for (const m of script.matchAll(/rows:\$R\[\d+\]=\[/g)) {
    const start = script.indexOf("[", script.indexOf("=", m.index!));
    const end = matchBracket(script, start);
    const blob = script.slice(start, end + 1);
    if (!blob.includes("mean_cost_usd")) continue;
    return serovalToJson(blob) as RawRow[];
  }
  throw new Error("DeepSWE: leaderboard rows array not found — page structure changed");
}

function extractMeta(script: string) {
  const generatedAt = /generated_at:"([^"]+)"/.exec(script)?.[1];
  const nTasks = /n_tasks_in_set:(\d+)/.exec(script)?.[1];
  if (!generatedAt) throw new Error("DeepSWE: generated_at not found");
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error(`DeepSWE: generated_at unparseable: ${generatedAt}`);
  }

  const jobMatch = /latest_job:\$R\[\d+\]=\{name:"([^"]+)",finished_at:"([^"]+)"\}/.exec(script);

  return {
    generatedAt,
    nTasksInSet: nTasks ? Number(nTasks) : 0,
    latestJob: jobMatch ? { name: jobMatch[1], finished_at: jobMatch[2] } : null,
  };
}

function num(row: RawRow, key: string): number {
  const v = row[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`DeepSWE: row ${String(row.config)} missing numeric field "${key}"`);
  }
  return v;
}

function optNum(row: RawRow, key: string): number | null {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function toConfig(row: RawRow): DeepSweConfig {
  const model = String(row.model ?? "");
  if (!model) throw new Error("DeepSWE: row with no model name");

  return {
    model,
    modelDisplay: displayName(model),
    effort: typeof row.reasoning_effort === "string" ? row.reasoning_effort : null,
    config: String(row.config ?? model),
    harness: String(row.harness ?? "unknown"),
    passAt1: num(row, "pass_at_1"),
    passAt4: optNum(row, "pass_at_4"),
    ciLo: optNum(row, "ci_lo") ?? num(row, "pass_at_1"),
    ciHi: optNum(row, "ci_hi") ?? num(row, "pass_at_1"),
    nRuns: optNum(row, "n_runs"),
    meanCostUsd: num(row, "mean_cost_usd"),
    meanOutputTokens: num(row, "mean_output_tokens"),
    meanAgentSteps: num(row, "mean_agent_steps"),
    meanInputTokens: optNum(row, "mean_input_tokens"),
    meanDurationSeconds: optNum(row, "mean_duration_seconds"),
    medianPeakContextTokens: optNum(row, "median_peak_context_tokens"),
  };
}

/**
 * DeepSWE encodes dots in model names as hyphens ("gpt-5-6-luna").
 * Restore them: a hyphen between two digits was a dot.
 */
export function displayName(model: string): string {
  return model.replace(/(\d)-(\d)/g, "$1.$2");
}

/**
 * Fail loudly rather than write a half-scraped snapshot over good data.
 * A silent 12-row scrape that still renders is the worst outcome here.
 */
function validate(configs: DeepSweConfig[]) {
  if (configs.length < 40) {
    throw new Error(`DeepSWE: only ${configs.length} configs parsed, expected >= 40`);
  }
  for (const c of configs) {
    if (c.passAt1 < 0 || c.passAt1 > 1) throw new Error(`DeepSWE: passAt1 out of range for ${c.config}`);
    if (c.meanCostUsd <= 0) throw new Error(`DeepSWE: non-positive cost for ${c.config}`);
    if (c.meanOutputTokens <= 0) throw new Error(`DeepSWE: non-positive output tokens for ${c.config}`);
    if (c.meanAgentSteps <= 0) throw new Error(`DeepSWE: non-positive agent steps for ${c.config}`);
  }

  // Guard against silently reading the stale artifact instead of the live page.
  const luna = configs.find((c) => c.model === "gpt-5-6-luna" && c.effort === "max");
  if (luna && luna.meanCostUsd > 2) {
    throw new Error(
      `DeepSWE: gpt-5-6-luna [max] cost $${luna.meanCostUsd.toFixed(3)} looks like the STALE ` +
        `artifact price ($3.028). Expected the live price (~$0.61). Refusing to write a snapshot.`,
    );
  }
}
