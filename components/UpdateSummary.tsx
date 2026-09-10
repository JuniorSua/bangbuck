import type { SnapshotUpdate } from "@/lib/diff";
import { shortDate } from "@/lib/format";

function teaser(update: SnapshotUpdate): string {
  const moved = update.tiers.filter((t) => t.beforeWinner !== t.afterWinner);
  const parts: string[] = [];
  if (moved.length === update.tiers.length && moved.length > 1) parts.push("new winner in every tier");
  else for (const t of moved) parts.push(`new ${t.label.toLowerCase()} winner`);
  if (update.newWebdev.length) parts.push(`${update.newWebdev.length} new on Arena WebDev`);
  return parts.join(" · ");
}

export function UpdateSummary({ update, capturedAt }: { update: SnapshotUpdate | null; capturedAt: string }) {
  if (!update || update.capturedAt !== capturedAt || (!update.tiers.length && !update.newWebdev.length)) return null;
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
      {update.newWebdev.length > 0 && <p className="mt-1">New WebDev entries: {update.newWebdev.join(", ")}.</p>}
    </div>
    </details>
  );
}
