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
  // qwen3.8-max's note retired 2026-08-04, the day DeepSWE measured it. The
  // claim held up: Alibaba reported 56.6 on DeepSWE 1.1 and the harness
  // measured 57.5 (CI 54.8-60.1) — a self-reported figure that survived
  // independent measurement. Kept here as the calibration point for how much
  // to trust the next claim that lands in this file.
];

export const noteFor = (model: string): ModelNote | undefined =>
  MODEL_NOTES.find((n) => n.model === model);
