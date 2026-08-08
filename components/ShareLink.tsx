"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/score";

/**
 * Copies the current view, tuned settings and all.
 *
 * The settings have lived in the query string for a while, but nothing on the
 * page said so, which made a genuinely useful feature invisible: the whole point
 * of exposing the floors is that someone can disagree, retune, and send back
 * "here is your data under my assumptions". That only works if they notice the
 * URL is doing anything.
 *
 * Deliberately not a Web Share sheet on desktop — copying a link is the quieter,
 * more predictable action, and it is what a reader comparing two tunings in two
 * tabs actually wants.
 */
export function ShareLink({ settings }: { settings: Settings }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2200);
    return () => clearTimeout(t);
  }, [state]);

  const tuned = (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).some(
    (k) => settings[k] !== DEFAULT_SETTINGS[k],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      // Clipboard is permission-gated and fails outright on insecure origins, so
      // say so rather than showing a success that did not happen.
      setState("failed");
    }
  };

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
      style={{
        borderColor: state === "copied" ? "var(--accent)" : "var(--border)",
        background: "rgba(255,255,255,0.03)",
        color: state === "copied" ? "var(--accent)" : "var(--text-muted)",
      }}
      aria-label={
        tuned ? "Copy a link to this view, including your settings" : "Copy a link to this view"
      }
    >
      {state === "copied" ? (
        <>
          <span aria-hidden="true">✓</span> Link copied
        </>
      ) : state === "failed" ? (
        <>Copy failed — select the address bar</>
      ) : (
        <>
          <span aria-hidden="true">🔗</span> {tuned ? "Copy link to these settings" : "Copy link"}
        </>
      )}
    </button>
  );
}
