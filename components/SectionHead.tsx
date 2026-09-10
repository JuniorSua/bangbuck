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
    <div className="section-head">
      <div className="section-title">
        <span className="section-number">{String(n).padStart(2, "0")}</span>
        <h2>{title}</h2>
      </div>
      {aside && <span className="section-aside">{aside}</span>}
    </div>
  );
}
