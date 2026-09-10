import type { ScoredConfig } from "@/lib/score";

/** Keep the source effort visible wherever a borrowed rating becomes a claim. */
export function CraftEvidence({ config, compact = false }: { config: ScoredConfig; compact?: boolean }) {
  const match = config.craftMatch;
  if (match.kind === "none") return <p className="mt-2 text-sm">No voted WebDev rating yet.</p>;
  const entry = match.entry;
  return (
    <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
      {match.kind === "family" ? "Craft estimated from " : "Craft directly matched to "}
      <a href="https://arena.ai/leaderboard/code" target="_blank" rel="noopener noreferrer"
        className="underline underline-offset-2">{entry.modelDisplayName}</a>.
      {!compact && <>
        {" "}{entry.votes.toLocaleString()} votes · {entry.rating.toFixed(0)} Elo
        {" "}(rating interval {entry.ratingLower.toFixed(0)}–{entry.ratingUpper.toFixed(0)}).
        {match.kind === "family" && " Arena has not rated this effort directly."}
        {" "}Craft is an Elo-based estimate against the board median, not an observed win percentage.
      </>}
    </p>
  );
}
