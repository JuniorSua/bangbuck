/**
 * Hand-written notes on models the scrapers cannot score, kept deliberately
 * apart from everything in data/snapshot.json.
 *
 * Every other number on this site is scraped from a source that measured it.
 * These are claims a vendor made about its own model, which is a different kind
 * of fact and must never be mixed into the ranking — a self-reported score has
 * no shared harness, no confidence interval, and no measured cost behind it.
 *
 * They earn their place because leaving them out is its own distortion: when a
 * model is plainly interesting and the only figure anyone has published is the
 * vendor's, saying nothing implies there is nothing to say. So they are shown,
 * attributed, and labelled self-reported wherever they appear.
 *
 * Rules for adding one:
 *   - `source` must be a URL a reader can open and check.
 *   - `selfReported` is true unless an independent party ran the benchmark.
 *   - Never feed these into lib/score.ts. They are annotation, not data.
 */
export interface ModelNote {
  /** Matches ArenaEntry.modelDisplayName exactly. */
  model: string;
  /** Claimed DeepSWE v1.1 pass@1, 0..1 — the same axis the ranking uses. */
  claimedShip?: number;
  selfReported: boolean;
  source: string;
  sourceLabel: string;
  note: string;
}

export const MODEL_NOTES: ModelNote[] = [
  {
    model: "qwen3.8-max",
    // Alibaba's launch materials put it at 56.6 on DeepSWE 1.1 — the same
    // benchmark and version this site's Ship axis reads. DeepSWE's own
    // leaderboard does not carry the model, so the figure cannot be verified
    // against the harness the other fifty configurations were run on.
    claimedShip: 0.566,
    selfReported: true,
    source: "https://www.marktechpost.com/2026/08/03/alibaba-qwen-releases-qwen3-8-max/",
    sourceLabel: "Alibaba launch benchmarks, 3 Aug 2026",
    note:
      "A 2.4T-parameter MoE released 3 August 2026. Alibaba reports 56.6 on DeepSWE 1.1 — " +
      "below both Ship floors here, so on its own numbers it would be gated out even if " +
      "DeepSWE listed it. Its Craft is not in doubt: fourth on Arena's WebDev board on 1,563 " +
      "human votes, level with claude-opus-5 [high]. Good taste, unproven follow-through.",
  },
];

export const noteFor = (model: string): ModelNote | undefined =>
  MODEL_NOTES.find((n) => n.model === model);
