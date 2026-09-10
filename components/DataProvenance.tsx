import type { Snapshot } from "@/lib/types";
import { shortDate } from "@/lib/format";

/**
 * The data is a captured snapshot, not a live feed. Say so plainly — showing a
 * relative "updated 2 hours ago" here would imply a freshness the site does not have.
 */
export function DataProvenance({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Source
          name="DeepSWE"
          href={snapshot.deepswe.sourceUrl}
          detail={`${snapshot.deepswe.configs.length} configs, ${snapshot.deepswe.nTasksInSet} real repo tasks. Supplies Ship and every measured cost figure.`}
          asOf={`Benchmark data as of ${shortDate(snapshot.deepswe.generatedAt)}`}
        />
        {snapshot.arenaWebdev && (
          <Source
            name="Arena WebDev"
            href={snapshot.arenaWebdev.sourceUrl}
            detail={`${snapshot.arenaWebdev.entries.length} models, human votes on web dev. Supplies Craft — never cost.`}
            asOf="Human-preference Elo"
          />
        )}
        {snapshot.arena && (
          <Source
            name="Arena chat"
            href={snapshot.arena.sourceUrl}
            detail={`${snapshot.arena.entries.length} models, general chat. Context only — chat rank says little about code.`}
            asOf="Human-preference Elo, list pricing"
          />
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Snapshot captured {shortDate(snapshot.capturedAt)} — refreshed when a new model ships, not
        on a timer.
      </p>
    </section>
  );
}

function Source({
  name,
  href,
  detail,
  asOf,
}: {
  name: string;
  href: string;
  detail: string;
  asOf: string;
}) {
  return (
    <div className="card-inset card-inset-hover p-7">
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm font-medium underline underline-offset-2"
        style={{ color: "var(--accent)" }}
      >
        {name} ↗
      </a>
      <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        {asOf}
      </p>
    </div>
  );
}
