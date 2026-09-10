import type { Snapshot } from "@/lib/types";
import { shortDate } from "@/lib/format";

/**
 * Oversized wordmark and a dense meta strip, in the spirit of the benchmark
 * leaderboards this site reads from — a reader arriving from DeepSWE should feel
 * on familiar ground.
 *
 * The twist is what the big type says. A leaderboard's headline names the
 * benchmark; this one states the claim, because the claim is the product.
 */
export function Hero({ snapshot }: { snapshot: Snapshot }) {
  const d = snapshot.deepswe;
  return (
    <header className="hero">
      <div className="hero-main">
      <h1 className="hero-title">
        Best code
        <br />
        per dollar.
      </h1>

      <p
        className="hero-copy"
        style={{ color: "var(--text-secondary)" }}
      >
        Two bars: <span style={{ color: "var(--text-primary)" }}>finish the job</span>, and{" "}
        <span style={{ color: "var(--text-primary)" }}>earn human preference on web tasks</span>. Then balance capability, measured cost, output tokens, and agent steps to find the best value.
      </p>

      </div>
      <dl className="hero-meta">
        <Meta k="Configurations" v={String(d.configs.length)} />
        <Meta k="Tasks" v={String(d.nTasksInSet)} />
        <Meta k="Benchmark" v="DeepSWE v1.1" />
        <Meta k="Craft" v="Arena WebDev" />
        <Meta k="Benchmark date" v={shortDate(d.generatedAt)} />
        <Meta k="Snapshot captured" v={shortDate(snapshot.capturedAt)} />
      </dl>
    </header>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd className="tnum font-medium" style={{ color: "var(--text-secondary)" }}>
        {v}
      </dd>
    </div>
  );
}

