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
          detail={`${snapshot.deepswe.configs.length} configurations across ${snapshot.deepswe.nTasksInSet} long-horizon software engineering tasks. Supplies the Ship axis and every measured cost figure: pass@1, cost per task, output tokens and agent steps.`}
          asOf={`Benchmark data as of ${shortDate(snapshot.deepswe.generatedAt)}`}
        />
        {snapshot.arenaWebdev && (
          <Source
            name="Arena WebDev"
            href={snapshot.arenaWebdev.sourceUrl}
            detail={`${snapshot.arenaWebdev.entries.length} models rated by human preference votes on web development specifically. Supplies the Craft axis. Arena measures no cost, tokens or steps, so it decides only whether a model is good enough to compete — never how cheap it is.`}
            asOf="Human-preference Elo"
          />
        )}
        {snapshot.arena && (
          <Source
            name="Arena chat"
            href={snapshot.arena.sourceUrl}
            detail={`${snapshot.arena.entries.length} models ranked on general conversation. Shown for context only and deliberately kept out of the score — a model's chat ranking says little about its code, which is the mistake this ranking was rebuilt to avoid.`}
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
