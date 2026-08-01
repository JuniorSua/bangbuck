import type { Snapshot } from "@/lib/types";
import { shortDate } from "@/lib/format";

/**
 * The data is a captured snapshot, not a live feed. Say so plainly — showing a
 * relative "updated 2 hours ago" here would imply a freshness the site does not have.
 */
export function DataProvenance({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section className="card p-6">
      <h2 className="mb-4 tight text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Where these numbers come from
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Source
          name="DeepSWE"
          href={snapshot.deepswe.sourceUrl}
          detail={`${snapshot.deepswe.configs.length} configurations across ${snapshot.deepswe.nTasksInSet} long-horizon software engineering tasks. Provides every measured figure used in the ranking: pass@1, cost, output tokens and agent steps.`}
          asOf={`Benchmark data as of ${shortDate(snapshot.deepswe.generatedAt)}`}
        />
        {snapshot.arena && (
          <Source
            name="arena.ai"
            href={snapshot.arena.sourceUrl}
            detail={`${snapshot.arena.entries.length} models ranked by human preference votes. Used only as a second opinion on quality — it has no measured cost, tokens or steps, so it does not affect the BangBuck score.`}
            asOf="Human-preference Elo, list pricing"
          />
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Snapshot captured {shortDate(snapshot.capturedAt)}. This site does not poll — benchmark
        results only change when a new model is evaluated, so the data is refreshed deliberately
        rather than on a timer.
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
    <div className="card-inset card-inset-hover p-4">
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm font-medium underline underline-offset-2"
        style={{ color: "var(--accent)" }}
      >
        {name} ↗
      </a>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        {asOf}
      </p>
    </div>
  );
}
