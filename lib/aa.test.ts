import { describe, expect, it } from "vitest";
import { aaAgentFor, aaFor, aaLeaders } from "./aa";
import { fetchArtificialAnalysis } from "./sources/artificial-analysis";
import type { AaData, AaModel } from "./types";

const model = (o: Partial<AaModel> & Pick<AaModel, "family" | "intelligence">): AaModel => ({
  slug: o.family, name: o.family, creator: null, effort: "max", releaseDate: null, terminalBench: null,
  priceIn: null, priceOut: null, costPerTask: null, outputTokensPerTask: null, outputSpeed: null, ...o,
});

const aa: AaData = {
  sourceUrl: "",
  models: [
    model({ family: "claude-opus-5-5", intelligence: 57.6, terminalBench: 0.596, costPerTask: 5.98 }),
    model({ family: "claude-opus-5-5", effort: "high", intelligence: 53.6, terminalBench: 0.566, costPerTask: 1.82, outputSpeed: 72 }),
    model({ family: "gpt-6-astra", effort: "xhigh", intelligence: 52.4, terminalBench: 0.596, costPerTask: 2.31, outputSpeed: 54 }),
    // Cheapest and fastest of all, but nowhere near the top: must not win either.
    model({ family: "gpt-6-luna", intelligence: 37.3, costPerTask: 0.07, outputSpeed: 142 }),
  ],
  codingAgents: [
    { agent: "Claude Code", creator: "Anthropic", model: "Fable 5.1 (max) (with fallback)", score: 62.2, costPerTask: 12.39, deepswe: 0.643, terminalBench: 0.576 },
    { agent: "Devin", creator: "Anthropic", model: "Claude Fable 5.1 XHigh + SWE-2", score: 61.7, costPerTask: 7.9, deepswe: 0.631, terminalBench: 0.561 },
    { agent: "Codex", creator: "OpenAI", model: "GPT-6 Sol (max)", score: 56.7, costPerTask: 2.99, deepswe: 0.69, terminalBench: 0.434 },
  ],
};

describe("Artificial Analysis second opinion", () => {
  const leaders = Object.fromEntries(aaLeaders(aa).map((l) => [l.id, l]));

  it("keeps cheap weak models out of 'near the top' and breaks ties on cost", () => {
    expect(leaders.cheapest.name).toBe("claude-opus-5-5");
    expect(leaders.cheapest.effort).toBe("high");
    expect(leaders.fastest.value).toBe("72 tok/s");
    // Opus max and Astra xhigh tie on Terminal-Bench; the $2.31 run takes it.
    expect(leaders.terminal.name).toBe("gpt-6-astra");
    expect(leaders.terminal.next?.name).toBe("claude-opus-5-5");
  });

  it("names a different family as runner-up, even across agent label styles", () => {
    expect(leaders.agent.name).toBe("Fable 5.1 (max) in Claude Code, $12.39/task");
    expect(leaders.agent.next?.name).toBe("GPT-6 Sol (max) in Codex, $2.99/task");
    expect(leaders.smartest.next?.name).toBe("gpt-6-astra");
  });

  it("matches DeepSWE and release slugs to AA records", () => {
    expect(aaFor(aa, "claude-opus-5.5")?.intelligence).toBe(57.6);
    expect(aaFor(aa, "claude-opus-5-5", "high")?.costPerTask).toBe(1.82);
    expect(aaFor(aa, "gpt-6-astra", "low")).toBeUndefined();
    expect(aaAgentFor(aa, "claude-fable-5-1")?.agent).toBe("Claude Code");
    expect(aaAgentFor(aa, "gpt-6-sol")?.deepswe).toBe(0.69);
    expect(aaAgentFor(aa, "claude-opus-5.5")).toBeUndefined();
  });

  it("parses the flight payload, dropping estimated and retired models", async () => {
    const record = (slug: string, extra: object = {}) => ({
      id: "00000000-0000-0000-0000-000000000000", slug, name: slug, release: { slug: "gpt-6-astra", name: "GPT-6 Astra" },
      effort: { slug: "max" }, intelligenceIndex: 50, price1mBlended0To3To1: 20,
      intelligenceIndexCostPerTask: { cost: { total: 3.26 } }, note: "a } inside a string", ...extra,
    });
    const records = [
      ...Array.from({ length: 60 }, (_, i) => record(`m${i}`)),
      record("guess", { intelligenceIndexIsEstimated: true }),
      record("old", { deprecated: true }),
    ];
    const rows = { rows: [{ agentName: "Codex", display: { agent: "Codex", model: "GPT-6 Astra (max)" }, indexScore: 0.616,
      mean: { costUsd: 7.47 }, evals: [{ datasetIndexName: "deep-swe-v1.1", mean: { reward: 0.676 } }] }] };
    const page = (payload: object) =>
      `<script>self.__next_f.push([1,${JSON.stringify(JSON.stringify(payload))}])</script>`;
    const home = page({ ...rows, rows: Array(5).fill(rows.rows[0]) });

    const data = await fetchArtificialAnalysis({ models: page(records), home });
    expect(data.models).toHaveLength(60);
    expect(data.models[0]).toMatchObject({ family: "gpt-6-astra", effort: "max", costPerTask: 3.26 });
    expect(data.codingAgents[0]).toMatchObject({ score: 61.6, deepswe: 0.676, costPerTask: 7.47 });
    await expect(fetchArtificialAnalysis({ models: page(records.slice(0, 10)), home })).rejects.toThrow(/only 10 models/);
  });
});
