"use client";

import { useState } from "react";
import type { Ranking, ScoredConfig } from "@/lib/score";
import { pct, steps, tokens, usdPrecise } from "@/lib/format";

type SortKey = "bb" | "passAt1" | "cost" | "tokens" | "steps" | "arena";

/**
 * All 50 configs. Below-floor rows stay visible but dimmed rather than being
 * hidden — seeing what got excluded, and by how little, is what makes the ranking
 * trustworthy rather than a black box.
 */
export function RankTable({ ranking }: { ranking: Ranking }) {
  const [sort, setSort] = useState<SortKey>("bb");
  const [desc, setDesc] = useState(true);

  const sorted = [...ranking.all].sort((a, b) => {
    // Below-floor configs have no meaningful BB score, so keep them at the bottom
    // when sorting by it rather than interleaving nonsense.
    if (sort === "bb" && a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    const v = value(a, sort) - value(b, sort);
    return desc ? -v : v;
  });

  const toggle = (k: SortKey) => {
    if (k === sort) setDesc(!desc);
    else {
      setSort(k);
      setDesc(true);
    }
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          All {ranking.all.length} configurations
        </h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {ranking.qualified.length} clear the floor · dimmed rows do not
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <Th>#</Th>
              <Th align="left">Model</Th>
              <Th sortable active={sort === "bb"} desc={desc} onClick={() => toggle("bb")}>
                BangBuck
              </Th>
              <Th sortable active={sort === "passAt1"} desc={desc} onClick={() => toggle("passAt1")}>
                Pass@1
              </Th>
              <Th sortable active={sort === "cost"} desc={desc} onClick={() => toggle("cost")}>
                Cost
              </Th>
              <Th sortable active={sort === "tokens"} desc={desc} onClick={() => toggle("tokens")}>
                Out tok
              </Th>
              <Th sortable active={sort === "steps"} desc={desc} onClick={() => toggle("steps")}>
                Steps
              </Th>
              <Th sortable active={sort === "arena"} desc={desc} onClick={() => toggle("arena")}>
                Arena Elo
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <Row key={s.label} s={s} isWinner={s.rank === 1} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Pass@1, cost, output tokens and agent steps are measured by DeepSWE across 113 tasks. Arena
        Elo is a separate human-preference rating and is shown per model family, so it does not vary
        by reasoning effort — it is a sanity check, not part of the BangBuck score.
      </p>
    </section>
  );
}

function Row({ s, isWinner }: { s: ScoredConfig; isWinner: boolean }) {
  const c = s.config;
  const dim = !s.qualified;
  return (
    <tr
      className="border-b last:border-0"
      style={{
        borderColor: "var(--border)",
        opacity: dim ? 0.42 : 1,
        background: isWinner ? "rgba(57,135,229,0.08)" : undefined,
      }}
    >
      <td className="px-3 py-2.5 tnum text-xs" style={{ color: "var(--text-muted)" }}>
        {s.rank ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <span
          className="font-medium"
          style={{ color: isWinner ? "var(--accent)" : "var(--text-primary)" }}
        >
          {c.modelDisplay}
        </span>
        {c.effort && (
          <span
            className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em]"
            style={{ color: "var(--text-muted)" }}
          >
            {c.effort}
          </span>
        )}
      </td>
      <Td accent={isWinner} bold>
        {s.qualified ? s.bb.toFixed(1) : "—"}
      </Td>
      <Td>
        {pct(c.passAt1, 1)}
        <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          ±{(((c.ciHi - c.ciLo) / 2) * 100).toFixed(0)}
        </span>
      </Td>
      <Td>{usdPrecise(c.meanCostUsd)}</Td>
      <Td>{tokens(c.meanOutputTokens)}</Td>
      <Td>{steps(c.meanAgentSteps)}</Td>
      <Td muted>{s.arena ? Math.round(s.arena.rating) : "—"}</Td>
    </tr>
  );
}

function Th({
  children,
  align = "right",
  sortable,
  active,
  desc,
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sortable?: boolean;
  active?: boolean;
  desc?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-xs font-medium uppercase tracking-[0.08em] ${
        align === "left" ? "text-left" : "text-right"
      }`}
      style={{ color: active ? "var(--text-secondary)" : "var(--text-muted)" }}
    >
      {sortable ? (
        <button onClick={onClick} className="hover:underline">
          {children}
          {active && <span className="ml-1">{desc ? "↓" : "↑"}</span>}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function Td({
  children,
  accent,
  bold,
  muted,
}: {
  children: React.ReactNode;
  accent?: boolean;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2.5 text-right tnum ${bold ? "font-semibold" : ""}`}
      style={{
        color: accent ? "var(--accent)" : muted ? "var(--text-muted)" : "var(--text-secondary)",
      }}
    >
      {children}
    </td>
  );
}

function value(s: ScoredConfig, key: SortKey): number {
  switch (key) {
    case "bb":
      return s.qualified ? s.bb : -1;
    case "passAt1":
      return s.config.passAt1;
    case "cost":
      return s.config.meanCostUsd;
    case "tokens":
      return s.config.meanOutputTokens;
    case "steps":
      return s.config.meanAgentSteps;
    case "arena":
      return s.arena?.rating ?? -1;
  }
}
