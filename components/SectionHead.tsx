/**
 * A numbered rule that separates the page into an argument rather than a stack.
 *
 * The page was five identical cards in a column, which reads as five unrelated
 * widgets. It is actually one argument in order — here is the answer, here is
 * the bar it had to clear, here is what paying more buys, here is everything
 * that lost — and numbering it is the cheapest way to say so. The rule fills the
 * remaining width so the eye is carried across rather than stopped at the title.
 */
export function SectionHead({
  n,
  title,
  aside,
}: {
  n: number;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-baseline gap-3 sm:gap-4">
      <span
        className="tnum shrink-0 font-mono text-[11px] tracking-[0.1em]"
        style={{ color: "var(--text-muted)" }}
      >
        {String(n).padStart(2, "0")}
      </span>
      <h2 className="tight min-w-0 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <span className="h-px min-w-4 flex-1" style={{ background: "var(--border)" }} />
      {/* Hidden on phones rather than wrapped: the aside is a gloss on the title,
          and a gloss that costs a line of vertical space stops being one. It was
          also the only thing pushing the page into horizontal scroll at 430px. */}
      {aside && (
        <span className="hidden shrink-0 text-xs sm:inline" style={{ color: "var(--text-muted)" }}>
          {aside}
        </span>
      )}
    </div>
  );
}
