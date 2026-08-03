"use client";

import { useState } from "react";
import type { Ranking, ScoredConfig } from "@/lib/score";
import { craftEloOf } from "@/lib/score";
import { pct, steps, tokens, usdPrecise } from "@/lib/format";
import { VendorMark } from "./VendorMark";

type SortKey = "bb" | "ship" | "craft" | "cost" | "tokens" | "steps";

/**
 * All 50 configs. Gated-out rows stay visible but dimmed rather than hidden —
 * seeing what got excluded, and by how little, is what makes the ranking
 * trustworthy rather than a black box. The specific value that failed is drawn in
 * the warning colour, so "why is this greyed out" is answerable at a glance.
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

  // The bars are drawn against the best score, not the widest visible one, so a
  // re-sort never rescales them and the winner's bar always reads as full.
  const topBb = Math.max(...ranking.qualified.map((s) => s.bb), 0);

  const toggle = (k: SortKey) => {
    if (k === sort) setDesc(!desc);
    else {
      setSort(k);
      setDesc(true);
    }
  };

  return (
    <section>
      {/* max-h + sticky thead: fifty rows is longer than any viewport, and a
          header that scrolls away turns the lower two-thirds into unlabelled
          numbers. */}
      <div className="card max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead
            className="sticky top-0 z-10"
            style={{ background: "var(--surface-1)", boxShadow: "0 1px 0 0 var(--border)" }}
          >
            <tr>
              <Th>#</Th>
              <Th align="left">Model</Th>
              <Th sortable active={sort === "bb"} desc={desc} onClick={() => toggle("bb")}>
                BangBuck
              </Th>
              <Th sortable active={sort === "ship"} desc={desc} onClick={() => toggle("ship")}>
                Ship
              </Th>
              <Th sortable active={sort === "craft"} desc={desc} onClick={() => toggle("craft")}>
                Craft
              </Th>
              <Th sortable active={sort === "cost"} desc={desc} onClick={() => toggle("cost")}>
                Cost
              </Th>
              <Th sortable active={sort === "tokens"} desc={desc} onClick={() => toggle("tokens")} hideOnPhone>
                Out tok
              </Th>
              <Th sortable active={sort === "steps"} desc={desc} onClick={() => toggle("steps")} hideOnPhone>
                Steps
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <Row key={s.label} s={s} isWinner={s.rank === 1} topBb={topBb} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        <strong style={{ color: "var(--text-secondary)" }}>Ship</strong> is DeepSWE pass@1 across 113
        real repo tasks, measured per configuration.{" "}
        <strong style={{ color: "var(--text-secondary)" }}>Craft</strong> is how often a human picks
        this model&rsquo;s web work over a typical model&rsquo;s, from Arena&rsquo;s WebDev board.
        Craft marked <span className="font-mono">~</span> is borrowed from the nearest reasoning
        effort of the same model, because Arena rates only{" "}
        {ranking.all.filter((s) => s.craftMatch.kind === "exact").length} of these {ranking.all.length}{" "}
        configurations directly — effort shows up on Ship, which is measured per configuration.
      </p>
    </section>
  );
}

function Row({ s, isWinner, topBb }: { s: ScoredConfig; isWinner: boolean; topBb: number }) {
  const c = s.config;
  const dim = !s.qualified;
  return (
    <tr
      className="row border-b last:border-0"
      style={{
        borderColor: "var(--border)",
        opacity: dim ? 0.42 : 1,
        background: isWinner ? "rgba(57,135,229,0.08)" : undefined,
      }}
    >
      <td
        className="px-3 py-2.5 tnum text-xs"
        style={{ color: isWinner ? "var(--accent)" : "var(--text-muted)" }}
      >
        {s.rank ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <span className="flex items-center gap-2">
          {/* Vendor first, so the column can be scanned by company without
              reading a single model name. Inherits the row's colour. */}
          <span
            className="flex shrink-0 items-center"
            style={{ color: isWinner ? "var(--accent)" : "var(--text-muted)" }}
          >
            <VendorMark organization={s.organization} />
          </span>
          <span
            className="font-medium"
            style={{ color: isWinner ? "var(--accent)" : "var(--text-primary)" }}
          >
            {c.modelDisplay}
          </span>
          {c.effort && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color: "var(--text-muted)" }}
            >
              {c.effort}
            </span>
          )}
        </span>
      </td>
      {/* The number and its share of the best score, together. Fifty rows of
          bare figures do not rank themselves; a bar the eye can run down does
          the comparing before any of them are actually read. */}
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <span
          className="tnum text-sm font-semibold"
          style={{ color: isWinner ? "var(--accent)" : "var(--text-secondary)" }}
        >
          {s.qualified ? s.bb.toFixed(2) : "—"}
        </span>
        <span
          className="mt-1 block h-[3px] overflow-hidden rounded-full"
          style={{ background: s.qualified ? "var(--baseline)" : "transparent" }}
          aria-hidden="true"
        >
          {s.qualified && topBb > 0 && (
            <span
              className="bb-bar"
              style={{
                // Rounded, and not only for tidiness. The browser truncates CSS
                // percentages when it parses them, so a raw float renders as
                // 73.54960673390156% on the client and reads back as 73.5496%
                // from the server's HTML — which React reports as a hydration
                // mismatch. Two decimals is already finer than a 116px bar can
                // draw.
                width: `${Math.max(2, (s.bb / topBb) * 100).toFixed(2)}%`,
                background: isWinner ? "var(--accent)" : "var(--text-muted)",
              }}
            />
          )}
        </span>
      </td>
      <Td warn={s.failed === "ship" || s.failed === "both"}>
        {pct(s.ship, 1)}
        <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          ±{(((c.ciHi - c.ciLo) / 2) * 100).toFixed(0)}
        </span>
      </Td>
      <Td warn={s.failed === "craft" || s.failed === "both"}>
        {s.craft === null ? (
          "—"
        ) : (
          <span title={`${craftEloOf(s).toFixed(0)} Elo on Arena WebDev`}>
            {pct(s.craft, 0)}
            {s.craftMatch.kind === "family" && (
              <span
                className="ml-0.5 font-mono text-[10px]"
                style={{ color: "var(--text-muted)" }}
                title={`Borrowed from the ${s.craftMatch.borrowedFrom} variant — Arena does not rate this effort`}
              >
                ~
              </span>
            )}
          </span>
        )}
      </Td>
      <Td>{usdPrecise(c.meanCostUsd)}</Td>
      <Td hideOnPhone>{tokens(c.meanOutputTokens)}</Td>
      <Td hideOnPhone>{steps(c.meanAgentSteps)}</Td>
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
  hideOnPhone,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sortable?: boolean;
  hideOnPhone?: boolean;
  active?: boolean;
  desc?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-xs font-medium uppercase tracking-[0.08em] ${
        align === "left" ? "text-left" : "text-right"
      } ${hideOnPhone ? "hidden sm:table-cell" : ""}`}
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
  warn,
  hideOnPhone,
}: {
  children: React.ReactNode;
  accent?: boolean;
  bold?: boolean;
  muted?: boolean;
  hideOnPhone?: boolean;
  /** This is the value that failed its floor — the reason the row is dimmed. */
  warn?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2.5 text-right tnum ${bold ? "font-semibold" : ""} ${
        hideOnPhone ? "hidden sm:table-cell" : ""
      }`}
      style={{
        color: accent
          ? "var(--accent)"
          : warn
            ? "var(--warning)"
            : muted
              ? "var(--text-muted)"
              : "var(--text-secondary)",
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
    case "ship":
      return s.ship;
    case "craft":
      return s.craft ?? -1;
    case "cost":
      return s.config.meanCostUsd;
    case "tokens":
      return s.config.meanOutputTokens;
    case "steps":
      return s.config.meanAgentSteps;
  }
}
