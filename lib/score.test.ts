import { describe, expect, it } from "vitest";
import snapshot from "../data/snapshot.json";
import { computeRanking, DEFAULT_SETTINGS, valueFrontier } from "./score";
import { familyKey } from "./normalize";
import { linearTicks } from "./metrics";
import type { Snapshot } from "./types";

const snap = snapshot as unknown as Snapshot;

/**
 * Golden tests. These encode the user's judgment call and were verified by hand
 * against the live leaderboards before any code was written. If the formula is
 * retuned, these numbers are what must be consciously re-agreed — not quietly
 * updated to match whatever the code now does.
 */
describe("BangBuck ranking at default settings", () => {
  const ranking = computeRanking(snap, DEFAULT_SETTINGS);

  it("crowns gpt-5.6-luna [max]", () => {
    expect(ranking.qualified[0].label).toBe("gpt-5.6-luna [max]");
    expect(ranking.qualified[0].bb).toBeCloseTo(38.79, 1);
  });

  it("qualifies 15 of 50 configs at a 65% floor", () => {
    expect(ranking.qualified).toHaveLength(15);
    expect(ranking.all).toHaveLength(50);
  });

  it("places claude-opus-5 [medium] third", () => {
    // The config the user had picked by hand before this site existed. Its landing
    // near the top is the check that the formula matches their intent rather than
    // having been reverse-engineered to a single answer.
    expect(ranking.qualified[2].label).toBe("claude-opus-5 [medium]");
  });

  it("has the winner leading by ~3.7x", () => {
    expect(ranking.insights!.leadMultiple).toBeCloseTo(3.75, 1);
  });

  it("ranks the top five in the verified order", () => {
    expect(ranking.qualified.slice(0, 5).map((s) => s.label)).toEqual([
      "gpt-5.6-luna [max]",
      "gpt-5.6-sol [high]",
      "claude-opus-5 [medium]",
      "gpt-5.6-sol [xhigh]",
      "gpt-5.6-terra [max]",
    ]);
  });
});

describe("the high-power tier (72.5% floor)", () => {
  const r = computeRanking(snap, { ...DEFAULT_SETTINGS, floor: 0.725 });

  it("crowns claude-opus-5 [high]", () => {
    expect(r.qualified[0].label).toBe("claude-opus-5 [high]");
    expect(r.insights!.leadMultiple).toBeCloseTo(1.32, 1);
  });

  it("admits only the four near-frontier configs", () => {
    expect(r.qualified.map((s) => s.label)).toEqual([
      "claude-opus-5 [high]",
      "gpt-5.6-sol [max]",
      "claude-opus-5 [xhigh]",
      "claude-opus-5 [max]",
    ]);
  });

  it("costs about half the frontier for 0.8 points less score", () => {
    const winner = r.qualified[0].config;
    const frontier = r.insights!.frontier.config;
    expect((frontier.passAt1 - winner.passAt1) * 100).toBeCloseTo(0.8, 1);
    expect(frontier.meanCostUsd / winner.meanCostUsd).toBeCloseTo(1.95, 1);
  });
});

describe("the capability floor", () => {
  it("flips the winner to gpt-5.6-sol [xhigh] at a 70% floor", () => {
    const r = computeRanking(snap, { ...DEFAULT_SETTINGS, floor: 0.7 });
    expect(r.qualified[0].label).toBe("gpt-5.6-sol [xhigh]");
    expect(r.qualified).toHaveLength(5);
  });

  it("does not crown a sub-45% config even at a lenient 50% floor", () => {
    // Without the floor, plain score/cost crowns gpt-5.6-luna [high] (44.2%, $0.16).
    // beta/gamma must not be so weak that cheap-and-unreliable wins anyway.
    const r = computeRanking(snap, { ...DEFAULT_SETTINGS, floor: 0.5 });
    expect(r.qualified[0].config.passAt1).toBeGreaterThan(0.45);
  });

  it("yields no winner when nothing clears the floor", () => {
    const r = computeRanking(snap, { ...DEFAULT_SETTINGS, floor: 0.99 });
    expect(r.qualified).toHaveLength(0);
    expect(r.insights).toBeNull();
    expect(r.all).toHaveLength(50);
  });

  it("keeps BB scores stable as the floor moves", () => {
    // Penalty baselines come from all configs, so filtering must not rescale scores.
    const a = computeRanking(snap, { ...DEFAULT_SETTINGS, floor: 0.6 });
    const b = computeRanking(snap, { ...DEFAULT_SETTINGS, floor: 0.7 });
    const find = (r: typeof a) => r.all.find((s) => s.label === "gpt-5.6-sol [xhigh]")!.bb;
    expect(find(a)).toBeCloseTo(find(b), 10);
  });
});

describe("why-it-won insights", () => {
  const { insights } = computeRanking(snap, DEFAULT_SETTINGS);

  it("reports 91% of frontier score for 5.1% of frontier price", () => {
    expect(insights!.frontier.label).toBe("claude-opus-5 [max]");
    expect(insights!.pctOfFrontierScore).toBeCloseTo(91.3, 0);
    expect(insights!.pctOfFrontierPrice).toBeCloseTo(5.1, 0);
    expect(insights!.cheaperThanFrontier).toBeCloseTo(19.5, 0);
  });

  it("shows that beating it on score costs 5.4x more", () => {
    expect(insights!.cheapestBetter!.label).toBe("claude-opus-5 [medium]");
    expect(insights!.cheapestBetterPriceMultiple).toBeCloseTo(5.4, 1);
    expect(insights!.cheapestBetterPointsGained).toBeCloseTo(1.7, 1);
  });

  it("shows that going cheaper costs 10.3 points of score", () => {
    expect(insights!.bestCheaper!.label).toBe("gpt-5.6-luna [xhigh]");
    expect(insights!.bestCheaperPointsLost).toBeCloseTo(10.3, 1);
  });

  it("computes the per-$100 hero stat", () => {
    expect(insights!.winner.solvedPer100).toBeCloseTo(111, -1);
    expect(insights!.frontier.solvedPer100).toBeCloseTo(6, 0);
  });
});

describe("snapshot integrity", () => {
  it("carries live pricing, not the stale artifact's", () => {
    const luna = snap.deepswe.configs.find(
      (c) => c.model === "gpt-5-6-luna" && c.effort === "max",
    )!;
    expect(luna.meanCostUsd).toBeLessThan(1); // stale artifact reports $3.028
    expect(luna.meanCostUsd).toBeCloseTo(0.6056, 3);
  });

  it("has 50 configs and Arena entries", () => {
    expect(snap.deepswe.configs).toHaveLength(50);
    expect(snap.arena!.entries.length).toBeGreaterThan(50);
  });
});

describe("hindsight check — the era before gpt-5.6 shipped", () => {
  /**
   * The user picked claude-opus-5 [medium] by hand as best bang-for-buck BEFORE the
   * gpt-5.6 generation existed. DeepSWE's own v1 snapshot (2026-06-20) confirms
   * none of luna/sol/terra were on the leaderboard then.
   *
   * Rewinding the field to that point must reproduce their pick with the formula
   * completely unchanged. If a future tuning breaks this, the formula has drifted
   * away from the judgment it was built to encode.
   */
  const withoutGeneration = (prefix: string) => ({
    ...snap,
    deepswe: {
      ...snap.deepswe,
      configs: snap.deepswe.configs.filter((c) => !c.model.startsWith(prefix)),
    },
  });

  it("crowns claude-opus-5 [medium] once the whole gpt-5.6 generation is removed", () => {
    const r = computeRanking(withoutGeneration("gpt-5-6"), DEFAULT_SETTINGS);
    expect(r.qualified[0].label).toBe("claude-opus-5 [medium]");
    expect(r.insights!.leadMultiple).toBeGreaterThan(1.8);
  });

  it("is a near tie with gpt-5.6-sol [high] if only luna is removed", () => {
    // Worth knowing: luna alone is not what displaced the old pick. sol [high]
    // edges it out by 8%, because sol is leaner on tokens and steps even though
    // opus-5 [medium] is the cheaper of the two.
    const onlyLuna = {
      ...snap,
      deepswe: {
        ...snap.deepswe,
        configs: snap.deepswe.configs.filter((c) => c.model !== "gpt-5-6-luna"),
      },
    };
    const r = computeRanking(onlyLuna, DEFAULT_SETTINGS);
    expect(r.qualified[0].label).toBe("gpt-5.6-sol [high]");
    expect(r.qualified[1].label).toBe("claude-opus-5 [medium]");
    expect(r.insights!.leadMultiple).toBeLessThan(1.15);
  });

  it("flips to claude-opus-5 [medium] when token/step penalties are switched off", () => {
    // The other way to read the user's judgment: weight only score and dollars.
    // opus-5 [medium] is genuinely cheaper per task; sol [high] only wins on the
    // efficiency penalties. Below beta = gamma ~= 0.075 the order reverses.
    const onlyLuna = {
      ...snap,
      deepswe: {
        ...snap.deepswe,
        configs: snap.deepswe.configs.filter((c) => c.model !== "gpt-5-6-luna"),
      },
    };
    const r = computeRanking(onlyLuna, { floor: 0.65, beta: 0, gamma: 0 });
    expect(r.qualified[0].label).toBe("claude-opus-5 [medium]");
  });
});

describe("valueFrontier", () => {
  const ranking = computeRanking(snap, DEFAULT_SETTINGS);
  const frontier = valueFrontier(ranking.all);

  it("includes the winner and the top-scoring model", () => {
    const labels = frontier.map((s) => s.label);
    expect(labels).toContain("gpt-5.6-luna [max]");
    expect(labels).toContain("claude-opus-5 [max]"); // nothing cheaper scores higher
  });

  it("is sorted by cost and strictly increasing in score", () => {
    // The defining property: paying more is the only way to score higher.
    for (let i = 1; i < frontier.length; i++) {
      expect(frontier[i].config.meanCostUsd).toBeGreaterThan(frontier[i - 1].config.meanCostUsd);
      expect(frontier[i].config.passAt1).toBeGreaterThan(frontier[i - 1].config.passAt1);
    }
  });

  it("excludes configs beaten on both price and score", () => {
    const labels = frontier.map((s) => s.label);
    // claude-sonnet-5 [max] costs $26.40 for 53.8% — luna [max] beats it on both.
    expect(labels).not.toContain("claude-sonnet-5 [max]");
    expect(frontier.length).toBeLessThan(ranking.all.length);
  });

  it("leaves every excluded config dominated by something on the line", () => {
    const off = ranking.all.filter((s) => !frontier.includes(s));
    for (const b of off) {
      const dominated = frontier.some(
        (a) =>
          a.config.meanCostUsd <= b.config.meanCostUsd && a.config.passAt1 >= b.config.passAt1,
      );
      expect(dominated).toBe(true);
    }
  });
});

describe("familyKey", () => {
  it("joins DeepSWE and Arena naming variants", () => {
    expect(familyKey("gpt-5-6-luna")).toBe("gpt56luna");
    expect(familyKey("gpt-5.6-luna-xhigh")).toBe("gpt56luna");
    expect(familyKey("gpt-5.6-luna-xhigh (codex-harness)")).toBe("gpt56luna");
    expect(familyKey("claude-opus-5-max")).toBe(familyKey("claude-opus-5"));
  });
});

describe("linearTicks", () => {
  it("gives readable steps near the target count", () => {
    // 276k output tokens: the naive 'first step >= max/target' rule produced a
    // 100k step and only three labels.
    expect(linearTicks(276000)).toEqual([0, 50000, 100000, 150000, 200000, 250000]);
    expect(linearTicks(268)).toEqual([0, 50, 100, 150, 200, 250]);
  });

  it("always starts at zero and never overshoots the max", () => {
    for (const max of [12, 268, 5000, 276000]) {
      const t = linearTicks(max);
      expect(t[0]).toBe(0);
      expect(t[t.length - 1]).toBeLessThanOrEqual(max);
    }
  });
});
