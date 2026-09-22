import type { SnapshotUpdate } from "@/lib/diff";
import { shortDate } from "@/lib/format";

function teaser(update: SnapshotUpdate): string {
  const moved = update.tiers.filter((t) => t.beforeWinner !== t.afterWinner);
  const parts: string[] = [];
  if (moved.length === update.tiers.length && moved.length > 1) parts.push("new winner in every tier");
  else for (const t of moved) parts.push(`new ${t.label.toLowerCase()} winner`);
  // One phrase per model: "gpt-6-astra 27–39% cheaper" reads faster than five rows.
  const byModel = new Map<string, number[]>();
  for (const c of update.costChanges ?? []) {
    const model = c.label.split(" [")[0];
    byModel.set(model, [...(byModel.get(model) ?? []), (c.after - c.before) / c.before]);
  }
  for (const [model, moves] of byModel) {
    const [lo, hi] = [Math.min(...moves), Math.max(...moves)].map((m) => Math.round(Math.abs(m) * 100));
    const range = lo === hi ? `${lo}%` : `${Math.min(lo, hi)}–${Math.max(lo, hi)}%`;
    if (moves.every((m) => m < 0)) parts.push(`${model} ${range} cheaper`);
    else if (moves.every((m) => m > 0)) parts.push(`${model} ${range} pricier`);
    else parts.push(`${model} cost changed`);
  }
  if (update.newWebdev.length) parts.push(`${update.newWebdev.length} new on Arena WebDev`);
  return parts.join(" · ");
}

export function UpdateSummary({ update, capturedAt }: { update: SnapshotUpdate | null; capturedAt: string }) {
  if (!update || update.capturedAt !== capturedAt || (!update.tiers.length && !update.newWebdev.length && !update.costChanges?.length)) return null;
  return (
    <details className="update-summary">
      {/* The closed line carries the headline, so nobody has to open it to learn
          that the answer moved. */}
      <summary>
        <span>
          What changed since {shortDate(update.previousCapturedAt)}
          {teaser(update) && <span className="update-teaser">{teaser(update)}</span>}
        </span>
      </summary>
      <div className="update-body">
      {update.tiers.map((tier) => <p key={tier.label} className="mt-1">
        {tier.label}: {tier.beforeWinner ?? "no qualifier"} → {tier.afterWinner ?? "no qualifier"}.
        {" "}{tier.afterCount} configurations now qualify (previously {tier.beforeCount}).
      </p>)}
      {!!update.costChanges?.length && <p className="mt-1">
        Measured cost per task:{" "}
        {update.costChanges.map((c) => `${c.label} $${c.before.toFixed(2)} → $${c.after.toFixed(2)}`).join(", ")}.
      </p>}
      {update.newWebdev.length > 0 && <p className="mt-1">New WebDev entries: {update.newWebdev.join(", ")}.</p>}
    </div>
    </details>
  );
}
