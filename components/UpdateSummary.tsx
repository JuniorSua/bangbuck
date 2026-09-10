import type { SnapshotUpdate } from "@/lib/diff";
import { shortDate } from "@/lib/format";

export function UpdateSummary({ update, capturedAt }: { update: SnapshotUpdate | null; capturedAt: string }) {
  if (!update || update.capturedAt !== capturedAt || (!update.tiers.length && !update.newWebdev.length)) return null;
  return (
    <details className="update-summary">
      <summary><span>What changed since {shortDate(update.previousCapturedAt)}</span></summary>
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
