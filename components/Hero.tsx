import type { Snapshot } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { Logo } from "./Logo";

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
    <header className="mb-10 sm:mb-12">
      <div className="mb-7 flex items-center gap-2.5">
        <Logo size={26} />
        <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--text-primary)" }}>
          Bang<span style={{ color: "var(--accent)" }}>Buck</span>
        </span>
      </div>

      <h1
        className="tight text-[2.6rem] font-semibold leading-[1.04] sm:text-[4rem] lg:text-[4.75rem]"
        style={{ color: "var(--text-primary)" }}
      >
        Best code
        <br />
        per dollar.
      </h1>

      <p
        className="mt-6 max-w-xl text-[15px] leading-relaxed sm:text-base"
        style={{ color: "var(--text-secondary)" }}
      >
        Leaderboards rank AI models by raw capability, so the most expensive model always wins. This
        ranks coding models by how much work you get per dollar — using{" "}
        <span style={{ color: "var(--text-primary)" }}>measured benchmark cost</span>, not list price.
        A model has to clear two bars to compete:{" "}
        <span style={{ color: "var(--text-primary)" }}>finish the job</span>, and write code a human
        would actually keep.
      </p>

      <dl className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <Meta k="Configurations" v={String(d.configs.length)} />
        <Dot />
        <Meta k="Tasks" v={String(d.nTasksInSet)} />
        <Dot />
        <Meta k="Benchmark" v="DeepSWE v1.1" />
        <Dot />
        <Meta k="Craft" v="Arena WebDev" />
        <Dot />
        <Meta k="Data as of" v={shortDate(d.generatedAt)} />
      </dl>
    </header>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="uppercase tracking-[0.1em]">{k}</dt>
      <dd className="tnum font-medium" style={{ color: "var(--text-secondary)" }}>
        {v}
      </dd>
    </div>
  );
}

const Dot = () => (
  <span aria-hidden="true" style={{ color: "var(--baseline)" }}>
    ·
  </span>
);
